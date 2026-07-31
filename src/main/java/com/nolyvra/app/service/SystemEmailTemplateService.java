package com.nolyvra.app.service;

import com.nolyvra.app.model.SystemEmailTemplateResponse;
import com.nolyvra.app.model.SystemEmailTemplateUpdateRequest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SystemEmailTemplateService {

    private static final Pattern VARIABLE = Pattern.compile("\\{\\{([a-z][a-z0-9_]*)}}");
    private static final Pattern UNSAFE_HTML = Pattern.compile(
            "(?is)<\\s*(script|iframe|object|embed|form|style|link|meta)\\b|"
                    + "\\bon[a-z]+\\s*=|(?:href|src)\\s*=\\s*(['\"]?)\\s*(javascript|data|vbscript):");
    private static final Pattern LINK_TARGET = Pattern.compile(
            "(?is)\\bhref\\s*=\\s*(['\"])(.*?)\\1");

    private final JdbcTemplate jdbc;
    private final Map<TemplateType, TemplateDefinition> definitions;

    public SystemEmailTemplateService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.definitions = defaults();
    }

    public List<SystemEmailTemplateResponse> list() {
        return definitions.keySet().stream().map(this::get).toList();
    }

    public SystemEmailTemplateResponse get(String key) {
        return get(type(key));
    }

    public SystemEmailTemplateResponse update(
            String key,
            SystemEmailTemplateUpdateRequest request,
            String updatedBy) {
        TemplateType type = type(key);
        TemplateDefinition definition = definitions.get(type);
        if (request == null || request.version() == null) {
            throw new IllegalArgumentException("version is required.");
        }
        String subject = requireContent(request.subject(), "subject");
        String htmlBody = requireContent(request.htmlBody(), "htmlBody");
        String textBody = requireContent(request.textBody(), "textBody");
        validate(definition, subject, htmlBody, textBody);

        int changed = jdbc.update("""
                insert into system_email_templates
                    (template_key, subject, html_body, text_body, enabled, version, updated_at, updated_by)
                values (?, ?, ?, ?, ?, 1, now(), ?)
                on conflict (template_key) do update
                set subject = excluded.subject,
                    html_body = excluded.html_body,
                    text_body = excluded.text_body,
                    enabled = excluded.enabled,
                    version = system_email_templates.version + 1,
                    updated_at = now(),
                    updated_by = excluded.updated_by
                where system_email_templates.version = ?
                """,
                type.key, subject, htmlBody, textBody,
                request.enabled() == null || request.enabled(), updatedBy, request.version());
        if (changed == 0) {
            throw new OptimisticLockingFailureException("Template was updated by another administrator.");
        }
        return get(type);
    }

    public SystemEmailTemplateResponse restore(String key, long version) {
        TemplateType type = type(key);
        if (version > 0) {
            int changed = jdbc.update(
                    "delete from system_email_templates where template_key = ? and version = ?",
                    type.key, version);
            if (changed == 0) {
                throw new OptimisticLockingFailureException(
                        "Template was updated by another administrator.");
            }
        }
        return get(type);
    }

    public RenderedTemplate render(String key, Map<String, String> variables) {
        TemplateDefinition definition = definitions.get(type(key));
        SystemEmailTemplateResponse template = get(key);
        Map<String, String> values = variables == null ? Map.of() : variables;
        for (String required : definition.requiredVariables) {
            if (!values.containsKey(required)) {
                throw new IllegalArgumentException("Missing required variable: " + required);
            }
        }
        return new RenderedTemplate(
                replace(template.subject(), values, false),
                replace(template.htmlBody(), values, true),
                replace(template.textBody(), values, false));
    }

    private SystemEmailTemplateResponse get(TemplateType type) {
        TemplateDefinition definition = definitions.get(type);
        List<StoredTemplate> stored = jdbc.query("""
                select subject, html_body, text_body, enabled, version, updated_at
                from system_email_templates
                where template_key = ?
                """, (rs, rowNum) -> new StoredTemplate(
                rs.getString("subject"),
                rs.getString("html_body"),
                rs.getString("text_body"),
                rs.getBoolean("enabled"),
                rs.getLong("version"),
                rs.getObject("updated_at", OffsetDateTime.class)), type.key);
        if (!stored.isEmpty() && isValid(definition, stored.get(0))) {
            StoredTemplate value = stored.get(0);
            return response(type, definition, value.subject, value.htmlBody, value.textBody,
                    value.enabled, value.version, value.updatedAt, true);
        }
        return response(type, definition, definition.subject, definition.htmlBody,
                definition.textBody, true, 0, null, false);
    }

    private boolean isValid(TemplateDefinition definition, StoredTemplate stored) {
        try {
            validate(definition, stored.subject, stored.htmlBody, stored.textBody);
            return true;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private void validate(TemplateDefinition definition, String subject, String htmlBody, String textBody) {
        if (UNSAFE_HTML.matcher(htmlBody).find()) {
            throw new IllegalArgumentException("HTML contains unsafe elements, attributes, or URL schemes.");
        }
        if (definition == definitions.get(TemplateType.PASSWORD_RESET)) {
            Matcher links = LINK_TARGET.matcher(htmlBody);
            while (links.find()) {
                if (!"{{reset_link}}".equals(links.group(2).trim())) {
                    throw new IllegalArgumentException(
                            "Password reset links must use the server-generated {{reset_link}} value.");
                }
            }
        }
        Set<String> found = variables(subject + "\n" + htmlBody + "\n" + textBody);
        List<String> unknown = found.stream()
                .filter(variable -> !definition.supportedVariables.contains(variable))
                .toList();
        if (!unknown.isEmpty()) {
            throw new IllegalArgumentException("Unsupported variable: " + unknown.get(0));
        }
        List<String> missing = definition.requiredVariables.stream()
                .filter(variable -> !found.contains(variable))
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Required variable is missing: " + missing.get(0));
        }
    }

    private Set<String> variables(String content) {
        java.util.LinkedHashSet<String> result = new java.util.LinkedHashSet<>();
        Matcher matcher = VARIABLE.matcher(content);
        while (matcher.find()) result.add(matcher.group(1));
        return result;
    }

    private String replace(String content, Map<String, String> values, boolean html) {
        Matcher matcher = VARIABLE.matcher(content);
        StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String value = values.getOrDefault(matcher.group(1), "");
            matcher.appendReplacement(result, Matcher.quoteReplacement(html ? escapeHtml(value) : value));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String requireContent(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required.");
        return value.trim();
    }

    private TemplateType type(String key) {
        if (key == null) throw new IllegalArgumentException("Unknown template key.");
        for (TemplateType type : TemplateType.values()) {
            if (type.key.equals(key.toLowerCase(Locale.ROOT))) return type;
        }
        throw new IllegalArgumentException("Unknown template key.");
    }

    private SystemEmailTemplateResponse response(
            TemplateType type, TemplateDefinition definition, String subject, String htmlBody,
            String textBody, boolean enabled, long version, OffsetDateTime updatedAt, boolean customized) {
        return new SystemEmailTemplateResponse(type.key, definition.name, subject, htmlBody,
                textBody, enabled, version, updatedAt, customized,
                List.copyOf(definition.supportedVariables), List.copyOf(definition.requiredVariables));
    }

    private Map<TemplateType, TemplateDefinition> defaults() {
        Map<TemplateType, TemplateDefinition> map = new LinkedHashMap<>();
        map.put(TemplateType.PASSWORD_RESET, new TemplateDefinition(
                "Password reset", "Reset your Nolyvra password",
                "<p>Use the link below to reset your password:</p><p><a href=\"{{reset_link}}\">Reset password</a></p><p>This link expires in {{expiry_minutes}} minutes.</p>",
                "Reset your password: {{reset_link}}\nThis link expires in {{expiry_minutes}} minutes.",
                List.of("reset_link", "expiry_minutes", "account_type"),
                List.of("reset_link", "expiry_minutes")));
        map.put(TemplateType.USER_ONBOARDING, new TemplateDefinition(
                "User onboarding", "Welcome to Nolyvra - registration approved",
                "<p>Hi {{name}},</p><p>Your account is ready. Sign in with {{email}}.</p><p>Your temporary password is:</p><p><strong>{{password}}</strong></p><p>Please change your password after your first login.</p>",
                "Hi {{name}}, your Nolyvra account is ready. Sign in with {{email}}. Your temporary password is: {{password}}. Please change it after your first login.",
                List.of("name", "email", "password"), List.of("name", "password")));
        map.put(TemplateType.REGISTRATION_CONFIRMATION, new TemplateDefinition(
                "Registration confirmation", "Thanks for your interest in Nolyvra",
                "<p>Hi {{name}},</p><p>We have received your registration.</p>",
                "Hi {{name}}, we have received your registration.",
                List.of("name"), List.of("name")));
        map.put(TemplateType.INTERNAL_ONBOARDING_NOTIFICATION, new TemplateDefinition(
                "Internal onboarding notification", "User onboarded: {{name}}",
                "<p>{{name}} ({{email}}) was onboarded by {{admin_login_id}}.</p>",
                "{{name}} ({{email}}) was onboarded by {{admin_login_id}}.",
                List.of("name", "email", "company", "admin_login_id"), List.of("name", "email")));
        map.put(TemplateType.NEW_REGISTRATION_NOTIFICATION, new TemplateDefinition(
                "New registration notification", "New registration: {{name}}",
                "<p>{{name}} registered with {{email}} from {{company}}.</p>",
                "{{name}} registered with {{email}} from {{company}}.",
                List.of("name", "email", "company", "phone"), List.of("name", "email")));
        return map;
    }

    private enum TemplateType {
        PASSWORD_RESET("password_reset"),
        USER_ONBOARDING("user_onboarding"),
        REGISTRATION_CONFIRMATION("registration_confirmation"),
        INTERNAL_ONBOARDING_NOTIFICATION("internal_onboarding_notification"),
        NEW_REGISTRATION_NOTIFICATION("new_registration_notification");

        private final String key;
        TemplateType(String key) { this.key = key; }
    }

    private record TemplateDefinition(
            String name, String subject, String htmlBody, String textBody,
            List<String> supportedVariables, List<String> requiredVariables) {
    }

    private record StoredTemplate(
            String subject, String htmlBody, String textBody, boolean enabled,
            long version, OffsetDateTime updatedAt) {
    }

    public record RenderedTemplate(String subject, String htmlBody, String textBody) {
    }
}
