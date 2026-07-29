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
    private final EmailService emailService = mock(EmailService.class);
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
                jdbc, emailService, "https://app.nolyvra.test/", 30, clock, secureRandom);
    }

    @Test
    void requestResetDoesNothingForUnknownEmail() {
        when(jdbc.query(
                contains("where lower(email) = ?"),
                any(RowMapper.class),
                eq("unknown@example.com")))
                .thenReturn(List.of());

        service.requestReset(" Unknown@Example.com ");

        verifyNoInteractions(emailService);
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
        verify(emailService).sendSystemEmail(
                eq("user@example.com"),
                eq("Reset your nolyvra password"),
                contains("https://app.nolyvra.test/reset-password?token=BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc"));
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
