package com.nolyvra.app.service;

import com.nolyvra.app.model.SystemEmailTemplateResponse;
import com.nolyvra.app.model.SystemEmailTemplateUpdateRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SystemEmailTemplateServiceTest {

    private JdbcTemplate jdbc;
    private SystemEmailTemplateService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        service = new SystemEmailTemplateService(jdbc);
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any()))
                .thenReturn(List.of());
    }

    @Test
    void listsStableSupportedTemplateKeysWithSafeDefaults() {
        List<SystemEmailTemplateResponse> templates = service.list();

        assertEquals(List.of(
                "password_reset",
                "user_onboarding",
                "registration_confirmation",
                "internal_onboarding_notification",
                "new_registration_notification"), templates.stream().map(SystemEmailTemplateResponse::key).toList());
        assertTrue(templates.stream().noneMatch(SystemEmailTemplateResponse::customized));
    }

    @Test
    void validatesRequiredAndSupportedVariablesAndUnsafeHtml() {
        SystemEmailTemplateUpdateRequest missingResetLink = new SystemEmailTemplateUpdateRequest(
                "Reset", "<p>Expires in {{expiry_minutes}}</p>",
                "Expires in {{expiry_minutes}}", true, 0L);
        assertThrows(IllegalArgumentException.class,
                () -> service.update("password_reset", missingResetLink, "admin"));

        SystemEmailTemplateUpdateRequest unknownVariable = new SystemEmailTemplateUpdateRequest(
                "Reset", "<p>{{reset_link}} {{expiry_minutes}} {{token}}</p>",
                "{{reset_link}} {{expiry_minutes}}", true, 0L);
        assertThrows(IllegalArgumentException.class,
                () -> service.update("password_reset", unknownVariable, "admin"));

        SystemEmailTemplateUpdateRequest script = new SystemEmailTemplateUpdateRequest(
                "Reset", "<script>alert(1)</script>{{reset_link}} {{expiry_minutes}}",
                "{{reset_link}} {{expiry_minutes}}", true, 0L);
        assertThrows(IllegalArgumentException.class,
                () -> service.update("password_reset", script, "admin"));

        SystemEmailTemplateUpdateRequest administratorControlledLink = new SystemEmailTemplateUpdateRequest(
                "Reset", "<a href=\"https://example.test\">{{reset_link}}</a> {{expiry_minutes}}",
                "{{reset_link}} {{expiry_minutes}}", true, 0L);
        assertThrows(IllegalArgumentException.class,
                () -> service.update("password_reset", administratorControlledLink, "admin"));
    }

    @Test
    void persistsOnlyKnownValidTemplatesWithOptimisticVersion() {
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        SystemEmailTemplateUpdateRequest request = new SystemEmailTemplateUpdateRequest(
                "Reset password", "<a href=\"{{reset_link}}\">Reset</a><p>{{expiry_minutes}}</p>",
                "{{reset_link}} expires in {{expiry_minutes}}", true, 0L);

        service.update("password_reset", request, "admin@example.com");

        verify(jdbc).update(anyString(), eq("password_reset"), eq("Reset password"),
                eq("<a href=\"{{reset_link}}\">Reset</a><p>{{expiry_minutes}}</p>"),
                eq("{{reset_link}} expires in {{expiry_minutes}}"), eq(true),
                eq("admin@example.com"), eq(0L));
        assertThrows(IllegalArgumentException.class,
                () -> service.update("arbitrary_key", request, "admin@example.com"));
    }

    @Test
    void rejectsSilentOverwrite() {
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);
        SystemEmailTemplateUpdateRequest request = new SystemEmailTemplateUpdateRequest(
                "Reset", "{{reset_link}} {{expiry_minutes}}",
                "{{reset_link}} {{expiry_minutes}}", true, 4L);

        assertThrows(OptimisticLockingFailureException.class,
                () -> service.update("password_reset", request, "admin"));
    }

    @Test
    void rendersWithHtmlEscapingAndRequiredRuntimeValues() {
        SystemEmailTemplateService.RenderedTemplate rendered = service.render("password_reset", Map.of(
                "reset_link", "https://example.test/reset?a=1&b=<unsafe>",
                "expiry_minutes", "30"));

        assertTrue(rendered.htmlBody().contains("&amp;"));
        assertTrue(rendered.htmlBody().contains("&lt;unsafe&gt;"));
        assertTrue(rendered.textBody().contains("https://example.test/reset"));
        assertThrows(IllegalArgumentException.class,
                () -> service.render("password_reset", Map.of("expiry_minutes", "30")));
    }

    @Test
    void restoreDeletesCustomizationAndReturnsDefault() {
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        SystemEmailTemplateResponse restored = service.restore("password_reset", 3L);

        verify(jdbc).update(
                "delete from system_email_templates where template_key = ? and version = ?",
                "password_reset", 3L);
        assertFalse(restored.customized());
        assertEquals(0, restored.version());
    }

    @Test
    @SuppressWarnings("unchecked")
    void invalidStoredTemplateFallsBackToDefault() throws Exception {
        when(jdbc.query(anyString(), any(RowMapper.class), any())).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(1);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getString("subject")).thenReturn("Compromised");
            when(resultSet.getString("html_body")).thenReturn("<script>alert(1)</script>");
            when(resultSet.getString("text_body")).thenReturn("invalid");
            when(resultSet.getBoolean("enabled")).thenReturn(true);
            when(resultSet.getLong("version")).thenReturn(9L);
            when(resultSet.getObject("updated_at", OffsetDateTime.class)).thenReturn(OffsetDateTime.now());
            return List.of(mapper.mapRow(resultSet, 0));
        });

        SystemEmailTemplateResponse template = service.get("password_reset");

        assertFalse(template.customized());
        assertEquals(0, template.version());
        assertTrue(template.htmlBody().contains("{{reset_link}}"));
    }
}
