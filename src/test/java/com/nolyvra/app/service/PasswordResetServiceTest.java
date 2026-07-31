package com.nolyvra.app.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PasswordResetServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ResendEmailService resendEmailService = mock(ResendEmailService.class);
    private final SystemEmailTemplateService systemEmailTemplateService = mock(SystemEmailTemplateService.class);
    private final SecureRandom secureRandom = mock(SecureRandom.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-29T08:00:00Z"), ZoneOffset.UTC);
    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        doAnswer(invocation -> {
            Arrays.fill(invocation.getArgument(0, byte[].class), (byte) 7);
            return null;
        }).when(secureRandom).nextBytes(any(byte[].class));
        service = new PasswordResetService(
                jdbc, resendEmailService, systemEmailTemplateService,
                "https://app.nolyvra.test/", 30, clock, secureRandom);
        when(systemEmailTemplateService.render(eq("password_reset"), anyMap()))
                .thenThrow(new IllegalStateException("use fallback by default"));
    }

    @Test
    void requestResetDoesNothingForUnknownEmail() {
        when(jdbc.query(
                contains("where lower(email) = ?"),
                any(RowMapper.class),
                eq("unknown@example.com")))
                .thenReturn(List.of());

        service.requestReset(" Unknown@Example.com ");

        verifyNoInteractions(resendEmailService);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void requestResetStoresHashedTokenAndEmailsRawToken() {
        when(jdbc.query(
                contains("where lower(email) = ?"),
                any(RowMapper.class),
                eq("user@example.com")))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    var resultSet = mock(java.sql.ResultSet.class);
                    when(resultSet.getString("id")).thenReturn("login-1");
                    when(resultSet.getString("email")).thenReturn("user@example.com");
                    return List.of(mapper.mapRow(resultSet, 0));
                });
        when(jdbc.queryForObject(
                contains("created_at > now()"),
                eq(Integer.class),
                eq("login-1")))
                .thenReturn(0);

        service.requestReset("USER@example.com");

        verify(jdbc).update(
                contains("insert into password_reset_tokens"),
                argThat(hash -> hash instanceof String value
                        && value.matches("[a-f0-9]{64}")
                        && !value.contains("BwcH")),
                eq("login-1"),
                any(),
                any());
        verify(resendEmailService).sendText(
                eq("user@example.com"),
                eq("Reset your nolyvra password"),
                contains("https://app.nolyvra.test/reset-password?token=BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc"));
    }

    @Test
    void requestResetUsesManagedSubjectAndVariables() {
        when(jdbc.query(
                contains("where lower(email) = ?"),
                any(RowMapper.class),
                eq("user@example.com")))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    var resultSet = mock(java.sql.ResultSet.class);
                    when(resultSet.getString("id")).thenReturn("login-1");
                    when(resultSet.getString("email")).thenReturn("user@example.com");
                    return List.of(mapper.mapRow(resultSet, 0));
                });
        when(jdbc.queryForObject(contains("created_at > now()"), eq(Integer.class), eq("login-1")))
                .thenReturn(0);
        when(systemEmailTemplateService.render(eq("password_reset"), anyMap()))
                .thenReturn(new SystemEmailTemplateService.RenderedTemplate(
                        "Managed reset subject", "<p>managed</p>", "Managed reset body"));

        service.requestReset("user@example.com");

        verify(systemEmailTemplateService).render(eq("password_reset"), argThat(values ->
                values.get("reset_link").startsWith("https://app.nolyvra.test/reset-password?token=")
                        && values.get("expiry_minutes").equals("30")
                        && values.get("account_type").equals("tenant")));
        verify(resendEmailService).sendText(
                "user@example.com", "Managed reset subject", "Managed reset body");
    }

    @Test
    void employeeResetUsesSeparateTokenTableAndEmployeeLink() {
        when(jdbc.query(
                contains("from employees"),
                any(RowMapper.class),
                eq("employee@example.com")))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    var resultSet = mock(java.sql.ResultSet.class);
                    when(resultSet.getString("id")).thenReturn("employee-1");
                    when(resultSet.getString("email")).thenReturn("employee@example.com");
                    return List.of(mapper.mapRow(resultSet, 0));
                });
        when(jdbc.queryForObject(
                contains("from employee_password_reset_tokens"),
                eq(Integer.class),
                eq("employee-1")))
                .thenReturn(0);

        service.requestReset("employee@example.com", PasswordResetService.AccountType.EMPLOYEE);

        verify(jdbc).update(
                contains("insert into employee_password_reset_tokens"),
                anyString(),
                eq("employee-1"),
                any(),
                any());
        verify(resendEmailService).sendText(
                eq("employee@example.com"),
                eq("Reset your nolyvra password"),
                contains("&type=employee"));
    }

    @Test
    void resetPasswordConsumesTokenUpdatesPasswordAndInvalidatesSessions() {
        when(jdbc.query(
                contains("returning login_id"),
                any(RowMapper.class),
                any(),
                anyString()))
                .thenReturn(List.of("login-1"));

        assertThat(service.resetPassword("raw-token", "a-secure-password")).isTrue();

        verify(jdbc).update(
                contains("update login"),
                argThat(hash -> hash instanceof String value && value.matches("[a-f0-9]{64}")),
                any(),
                eq("login-1"));
        verify(jdbc).update(
                contains("update user_sessions"),
                eq("login-1"));
    }

    @Test
    void resetPasswordRejectsShortPasswordWithoutDatabaseAccess() {
        assertThat(service.resetPassword("raw-token", "short")).isFalse();

        verifyNoInteractions(jdbc);
    }

    @Test
    void employeeResetUpdatesEmployeeAndInvalidatesEmployeeSessions() {
        when(jdbc.query(
                contains("returning prt.employee_id"),
                any(RowMapper.class),
                any(),
                anyString()))
                .thenReturn(List.of("employee-1"));

        assertThat(service.resetPassword(
                "employee-token",
                "a-secure-password",
                PasswordResetService.AccountType.EMPLOYEE)).isTrue();

        verify(jdbc).update(
                contains("update employees"),
                argThat(hash -> hash instanceof String value && value.matches("[a-f0-9]{64}")),
                any(),
                eq("employee-1"));
        verify(jdbc).update(
                contains("update employee_sessions"),
                eq("employee-1"));
        verify(jdbc, never()).update(
                contains("update user_sessions"),
                any(Object[].class));
    }

    @Test
    void usedOrExpiredTokenCannotResetPassword() {
        when(jdbc.query(
                contains("returning login_id"),
                any(RowMapper.class),
                any(),
                anyString()))
                .thenReturn(List.of());

        assertThat(service.resetPassword("expired-token", "another-secure-password")).isFalse();

        verify(jdbc, never()).update(contains("update login"), any(), any(), any());
    }
}
