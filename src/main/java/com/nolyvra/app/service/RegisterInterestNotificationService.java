package com.nolyvra.app.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RegisterInterestNotificationService {

    private final AdminSettingsService adminSettingsService;
    private final String apiKey;
    private final String fromAddress;

    public RegisterInterestNotificationService(
            AdminSettingsService adminSettingsService,
            @Value("${resend.api-key:}") String apiKey,
            @Value("${resend.from:Nolyvra <onboarding@resend.dev>}") String fromAddress) {
        this.adminSettingsService = adminSettingsService;
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
    }

    public void notifyNewRegistration(String firstName, String lastName, String company, String email, String phone) {
        List<String> recipients = adminSettingsService.getRegisterInterestNotificationEmails();
        if (recipients.isEmpty()) {
            System.out.println("Register interest notification skipped: no admin recipients configured.");
            return;
        }
        if (apiKey == null || apiKey.isBlank() || "re_xxxxxxxxx".equals(apiKey.trim())) {
            System.err.println("Register interest notification skipped: RESEND_API_KEY is not configured.");
            return;
        }

        String fullName = (safe(firstName) + " " + safe(lastName)).trim();
        String subject = "New register interest submission" + (fullName.isBlank() ? "" : ": " + fullName);
        String html = """
                <h2>New Register Interest Submission</h2>
                <p>A new user submitted the landing page register interest form.</p>
                <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
                  <tr><td><strong>Name</strong></td><td>%s</td></tr>
                  <tr><td><strong>Email</strong></td><td>%s</td></tr>
                  <tr><td><strong>Company</strong></td><td>%s</td></tr>
                  <tr><td><strong>Phone</strong></td><td>%s</td></tr>
                </table>
                """.formatted(
                escapeHtml(fullName.isBlank() ? "-" : fullName),
                escapeHtml(email),
                escapeHtml(company),
                escapeHtml(phone == null || phone.isBlank() ? "-" : phone));

        try {
            Resend resend = new Resend(apiKey.trim());
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(recipients.toArray(String[]::new))
                    .subject(subject)
                    .html(html)
                    .build();
            CreateEmailResponse response = resend.emails().send(params);
            System.out.println("Register interest notification sent via Resend: " + response.getId());
        } catch (ResendException e) {
            System.err.println("Failed to send register interest notification via Resend: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Failed to send register interest notification: " + e.getMessage());
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String escapeHtml(String value) {
        return safe(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
