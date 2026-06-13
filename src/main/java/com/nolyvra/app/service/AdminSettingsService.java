package com.nolyvra.app.service;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class AdminSettingsService {

    private static final String REGISTER_INTEREST_NOTIFICATION_EMAILS =
            "register_interest_notification_emails";
    private static final String REGISTER_INTEREST_CONFIRMATION_SUBJECT =
            "register_interest_confirmation_subject";
    private static final String REGISTER_INTEREST_CONFIRMATION_HTML =
            "register_interest_confirmation_html";
    private static final String REGISTER_INTEREST_NOTIFICATION_SUBJECT =
            "register_interest_notification_subject";
    private static final String REGISTER_INTEREST_NOTIFICATION_HTML =
            "register_interest_notification_html";
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    public static final String DEFAULT_CONFIRMATION_SUBJECT =
            "Thanks for your interest in Nolyvra";
    public static final String DEFAULT_CONFIRMATION_HTML = """
            <p>Hi {{name}},</p>
            <p>Thanks for registering your interest in Nolyvra. We have received your details and one of our team members will be in touch shortly.</p>
            <p>Best regards,<br>Nolyvra Team</p>
            """;
    public static final String DEFAULT_NOTIFICATION_SUBJECT =
            "New register interest submission: {{name}}";
    public static final String DEFAULT_NOTIFICATION_HTML = """
            <h2>New Register Interest Submission</h2>
            <p>A new user submitted the landing page register interest form.</p>
            <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
              <tr><td><strong>Name</strong></td><td>{{name}}</td></tr>
              <tr><td><strong>Email</strong></td><td>{{email}}</td></tr>
              <tr><td><strong>Company</strong></td><td>{{company}}</td></tr>
              <tr><td><strong>Phone</strong></td><td>{{phone}}</td></tr>
            </table>
            """;

    private final JdbcTemplate jdbc;

    public AdminSettingsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void ensureTable() {
        jdbc.execute("""
                create table if not exists app_settings (
                    setting_key text primary key,
                    setting_value text not null default '',
                    updated_at timestamp with time zone not null default now()
                )
                """);
    }

    public List<String> getRegisterInterestNotificationEmails() {
        List<String> values = jdbc.query("""
                select setting_value
                from app_settings
                where setting_key = ?
                """, (rs, rowNum) -> rs.getString("setting_value"), REGISTER_INTEREST_NOTIFICATION_EMAILS);

        if (values.isEmpty() || values.get(0) == null || values.get(0).isBlank()) {
            return List.of();
        }
        return parseEmails(values.get(0));
    }

    public List<String> saveRegisterInterestNotificationEmails(String rawEmails) {
        List<String> emails = parseEmails(rawEmails);
        String value = String.join(",", emails);

        saveSetting(REGISTER_INTEREST_NOTIFICATION_EMAILS, value);

        return emails;
    }

    public Map<String, String> getRegisterInterestEmailTemplates() {
        Map<String, String> templates = new LinkedHashMap<>();
        templates.put("confirmationSubject", getSetting(
                REGISTER_INTEREST_CONFIRMATION_SUBJECT, DEFAULT_CONFIRMATION_SUBJECT));
        templates.put("confirmationHtml", getSetting(
                REGISTER_INTEREST_CONFIRMATION_HTML, DEFAULT_CONFIRMATION_HTML));
        templates.put("notificationSubject", getSetting(
                REGISTER_INTEREST_NOTIFICATION_SUBJECT, DEFAULT_NOTIFICATION_SUBJECT));
        templates.put("notificationHtml", getSetting(
                REGISTER_INTEREST_NOTIFICATION_HTML, DEFAULT_NOTIFICATION_HTML));
        return templates;
    }

    public Map<String, String> saveRegisterInterestEmailTemplates(
            String confirmationSubject,
            String confirmationHtml,
            String notificationSubject,
            String notificationHtml) {
        saveSetting(REGISTER_INTEREST_CONFIRMATION_SUBJECT,
                valueOrDefault(confirmationSubject, DEFAULT_CONFIRMATION_SUBJECT));
        saveSetting(REGISTER_INTEREST_CONFIRMATION_HTML,
                valueOrDefault(confirmationHtml, DEFAULT_CONFIRMATION_HTML));
        saveSetting(REGISTER_INTEREST_NOTIFICATION_SUBJECT,
                valueOrDefault(notificationSubject, DEFAULT_NOTIFICATION_SUBJECT));
        saveSetting(REGISTER_INTEREST_NOTIFICATION_HTML,
                valueOrDefault(notificationHtml, DEFAULT_NOTIFICATION_HTML));
        return getRegisterInterestEmailTemplates();
    }

    private String getSetting(String key, String defaultValue) {
        List<String> values = jdbc.query("""
                select setting_value
                from app_settings
                where setting_key = ?
                """, (rs, rowNum) -> rs.getString("setting_value"), key);
        if (values.isEmpty() || values.get(0) == null || values.get(0).isBlank()) {
            return defaultValue;
        }
        return values.get(0);
    }

    private void saveSetting(String key, String value) {
        jdbc.update("""
                insert into app_settings (setting_key, setting_value, updated_at)
                values (?, ?, now())
                on conflict (setting_key)
                do update set setting_value = excluded.setting_value,
                              updated_at = now()
                """, key, value);
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private List<String> parseEmails(String rawEmails) {
        if (rawEmails == null || rawEmails.isBlank()) {
            return List.of();
        }
        return Arrays.stream(rawEmails.split("[,;\\n\\r\\t ]+"))
                .map(String::trim)
                .filter(email -> !email.isBlank())
                .distinct()
                .peek(email -> {
                    if (!EMAIL_PATTERN.matcher(email).matches()) {
                        throw new IllegalArgumentException("Invalid email address: " + email);
                    }
                })
                .toList();
    }
}
