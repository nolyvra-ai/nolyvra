package com.nolyvra.app.service;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class AdminSettingsService {

    private static final String REGISTER_INTEREST_NOTIFICATION_EMAILS =
            "register_interest_notification_emails";
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

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

        jdbc.update("""
                insert into app_settings (setting_key, setting_value, updated_at)
                values (?, ?, now())
                on conflict (setting_key)
                do update set setting_value = excluded.setting_value,
                              updated_at = now()
                """, REGISTER_INTEREST_NOTIFICATION_EMAILS, value);

        return emails;
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
