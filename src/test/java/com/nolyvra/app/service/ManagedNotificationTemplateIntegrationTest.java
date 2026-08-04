package com.nolyvra.app.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ManagedNotificationTemplateIntegrationTest {

    private SystemEmailTemplateService templates;
    private OnboardingEmailService onboarding;
    private RegisterInterestNotificationService registration;

    @BeforeEach
    void setUp() {
        templates = mock(SystemEmailTemplateService.class);
        AdminSettingsService settings = mock(AdminSettingsService.class);
        EmailTemplateImageService images = mock(EmailTemplateImageService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        onboarding = new OnboardingEmailService(
                settings, templates, images, jdbc, "resend-key", "from@example.com");
        registration = new RegisterInterestNotificationService(
                settings, templates, images, jdbc, "resend-key", "from@example.com");
    }

    @Test
    void onboardingUsesManagedUserAndInternalTemplates() {
        when(templates.render(eq("user_onboarding"), anyMap()))
                .thenReturn(new SystemEmailTemplateService.RenderedTemplate(
                        "Welcome Alice", "<p>Welcome Alice</p>", "Welcome Alice"));
        when(templates.render(eq("internal_onboarding_notification"), anyMap()))
                .thenReturn(new SystemEmailTemplateService.RenderedTemplate(
                        "Alice onboarded", "<p>Admin notification</p>", "Admin notification"));

        assertThat(onboarding.resolveTemplate(
                "user_onboarding", "fallback", "fallback", Map.of("name", "Alice", "email", "a@example.com")))
                .isEqualTo(new OnboardingEmailService.EmailContent(
                        "Welcome Alice", "<p>Welcome Alice</p>"));
        assertThat(onboarding.resolveTemplate(
                "internal_onboarding_notification", "fallback", "fallback",
                Map.of("name", "Alice", "email", "a@example.com")))
                .isEqualTo(new OnboardingEmailService.EmailContent(
                        "Alice onboarded", "<p>Admin notification</p>"));
    }

    @Test
    void registrationUsesManagedConfirmationAndNotificationTemplates() {
        when(templates.render(eq("registration_confirmation"), anyMap()))
                .thenReturn(new SystemEmailTemplateService.RenderedTemplate(
                        "Registration received", "<p>Thanks</p>", "Thanks"));
        when(templates.render(eq("new_registration_notification"), anyMap()))
                .thenReturn(new SystemEmailTemplateService.RenderedTemplate(
                        "New registration", "<p>New lead</p>", "New lead"));

        assertThat(registration.resolveTemplate(
                "registration_confirmation", "fallback", "fallback", Map.of("name", "Alice")))
                .isEqualTo(new RegisterInterestNotificationService.EmailContent(
                        "Registration received", "<p>Thanks</p>"));
        assertThat(registration.resolveTemplate(
                "new_registration_notification", "fallback", "fallback", Map.of("name", "Alice")))
                .isEqualTo(new RegisterInterestNotificationService.EmailContent(
                        "New registration", "<p>New lead</p>"));
    }

    @Test
    void templateFailureFallsBackAndEscapesValues() {
        when(templates.render(eq("registration_confirmation"), anyMap()))
                .thenThrow(new IllegalStateException("database unavailable"));

        RegisterInterestNotificationService.EmailContent content = registration.resolveTemplate(
                "registration_confirmation",
                "Welcome {{name}}",
                "<p>{{name}}</p>",
                Map.of("name", "<Admin>"));

        assertThat(content.subject()).isEqualTo("Welcome &lt;Admin&gt;");
        assertThat(content.html()).isEqualTo("<p>&lt;Admin&gt;</p>");
    }
}
