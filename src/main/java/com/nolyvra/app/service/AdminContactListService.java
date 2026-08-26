package com.nolyvra.app.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.AdminContactListContact;
import com.nolyvra.app.model.AdminContactListImportRequest;
import com.nolyvra.app.model.AdminContactListWorkspace;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

@Service
public class AdminContactListService {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Set<String> QUALITY_ISSUES = Set.of(
            "Missing email", "Invalid email format", "Duplicate email", "Category needs review");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public AdminContactListService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public AdminContactListWorkspace getWorkspace(String loginId) {
        List<WorkspaceMetadata> workspaces = jdbc.query("""
                select file_name, header_row, imported_at, updated_at
                from admin_contact_list_workspaces
                where login_id = ?
                """, (rs, rowNum) -> new WorkspaceMetadata(
                rs.getString("file_name"),
                (Integer) rs.getObject("header_row"),
                toOffsetDateTime(rs.getTimestamp("imported_at")),
                toOffsetDateTime(rs.getTimestamp("updated_at"))), loginId);

        if (workspaces.isEmpty()) {
            return new AdminContactListWorkspace("", null, null, null, List.of());
        }
        WorkspaceMetadata metadata = workspaces.get(0);
        return new AdminContactListWorkspace(
                metadata.fileName(), metadata.headerRow(), metadata.importedAt(), metadata.updatedAt(),
                getContacts(loginId));
    }

    @Transactional
    public AdminContactListWorkspace mergeWorkspace(String loginId, AdminContactListImportRequest request) {
        if (request == null || request.contacts() == null || request.contacts().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The import must contain at least one contact.");
        }
        String fileName = clean(request.fileName());
        if (fileName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A source file name is required.");
        }

        jdbc.update("""
                insert into admin_contact_list_workspaces
                    (login_id, file_name, header_row, imported_at, updated_at)
                values (?, ?, ?, now(), now())
                on conflict (login_id) do update set
                    file_name = excluded.file_name,
                    header_row = excluded.header_row,
                    imported_at = now(),
                    updated_at = now()
                """, loginId, fileName, request.headerRow());
        LinkedHashMap<String, AdminContactListContact> mergedByOwnerAndContact = new LinkedHashMap<>();
        for (AdminContactListContact saved : getContacts(loginId)) {
            mergedByOwnerAndContact.merge(
                    contactKey(saved), saved, this::mergeSavedDuplicates);
        }
        for (AdminContactListContact imported : request.contacts()) {
            mergedByOwnerAndContact.merge(
                    contactKey(imported), imported, this::mergeImportedContact);
        }
        List<AdminContactListContact> contacts = refreshQuality(
                mergedByOwnerAndContact.values().stream().toList());

        jdbc.update("delete from admin_contact_list_contacts where login_id = ?", loginId);
        List<Integer> contactIndexes = IntStream.range(0, contacts.size()).boxed().toList();
        jdbc.batchUpdate("""
                insert into admin_contact_list_contacts (
                    id, login_id, row_order, company, contact_name, email, phone, role,
                    segment, source, owner, stage, date_added, last_contact, next_action_date,
                    next_step, package_name, potential_mrr, notes, category, consent_status,
                    has_valid_email, is_duplicate, edited, issues_json)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, contactIndexes, 250, (PreparedStatement ps, Integer contactIndex) -> {
            AdminContactListContact contact = contacts.get(contactIndex);
            ps.setObject(1, UUID.randomUUID());
            ps.setString(2, loginId);
            ps.setInt(3, contactIndex);
            setContactValues(ps, contact, 4);
        });
        return getWorkspace(loginId);
    }

    private AdminContactListContact mergeImportedContact(
            AdminContactListContact saved, AdminContactListContact imported) {
        return new AdminContactListContact(
                saved.id(),
                preferImported(imported.company(), saved.company()),
                preferImported(imported.name(), saved.name()),
                preferImported(imported.email(), saved.email()),
                preferImported(imported.phone(), saved.phone()),
                preferImported(imported.role(), saved.role()),
                preferImported(imported.segment(), saved.segment()),
                preferImported(imported.source(), saved.source()),
                preferImported(imported.owner(), saved.owner()),
                preferImported(imported.stage(), saved.stage()),
                preferImported(imported.dateAdded(), saved.dateAdded()),
                preferImported(imported.lastContact(), saved.lastContact()),
                preferImported(imported.nextActionDate(), saved.nextActionDate()),
                preferImported(imported.nextStep(), saved.nextStep()),
                preferImported(imported.packageName(), saved.packageName()),
                preferImported(imported.potentialMrr(), saved.potentialMrr()),
                preferImported(imported.notes(), saved.notes()),
                saved.edited() ? saved.category() : imported.category(),
                saved.consentStatus(),
                false,
                false,
                saved.edited(),
                imported.issues());
    }

    private AdminContactListContact mergeSavedDuplicates(
            AdminContactListContact first, AdminContactListContact later) {
        AdminContactListContact merged = mergeImportedContact(first, later);
        String consent = "Unsubscribed".equals(first.consentStatus()) || "Unsubscribed".equals(later.consentStatus())
                ? "Unsubscribed"
                : ("Confirmed".equals(first.consentStatus()) || "Confirmed".equals(later.consentStatus())
                    ? "Confirmed" : "Unknown");
        return new AdminContactListContact(
                first.id(), merged.company(), merged.name(), merged.email(), merged.phone(), merged.role(),
                merged.segment(), merged.source(), merged.owner(), merged.stage(), merged.dateAdded(),
                merged.lastContact(), merged.nextActionDate(), merged.nextStep(), merged.packageName(),
                merged.potentialMrr(), merged.notes(),
                first.edited() ? first.category() : merged.category(), consent,
                false, false, first.edited() || later.edited(), merged.issues());
    }

    private List<AdminContactListContact> refreshQuality(List<AdminContactListContact> contacts) {
        Set<String> seenEmails = new HashSet<>();
        return contacts.stream().map(contact -> {
            boolean hasValidEmail = EMAIL_PATTERN.matcher(clean(contact.email())).matches();
            List<String> issues = new java.util.ArrayList<>(Optional.ofNullable(contact.issues())
                    .orElse(List.of()).stream().filter(issue -> !QUALITY_ISSUES.contains(issue)).toList());
            if (clean(contact.email()).isBlank()) {
                issues.add("Missing email");
            } else if (!hasValidEmail) {
                issues.add("Invalid email format");
            }
            boolean duplicate = hasValidEmail && !seenEmails.add(clean(contact.email()).toLowerCase(Locale.ROOT));
            if (duplicate) issues.add("Duplicate email");
            if ("Needs review".equals(contact.category())) issues.add("Category needs review");
            return new AdminContactListContact(
                    contact.id(), contact.company(), contact.name(), contact.email(), contact.phone(), contact.role(),
                    contact.segment(), contact.source(), contact.owner(), contact.stage(), contact.dateAdded(),
                    contact.lastContact(), contact.nextActionDate(), contact.nextStep(), contact.packageName(),
                    contact.potentialMrr(), contact.notes(),
                    contact.category(), contact.consentStatus(), hasValidEmail, duplicate, contact.edited(), issues);
        }).toList();
    }

    private String contactKey(AdminContactListContact contact) {
        String owner = normaliseKey(contact.owner());
        String name = normaliseKey(contact.name());
        if (!name.isBlank()) return owner + "|name:" + name;
        String email = normaliseKey(contact.email());
        if (!email.isBlank()) return owner + "|email:" + email;
        return owner + "|id:" + Optional.ofNullable(contact.id()).orElse(UUID.randomUUID().toString());
    }

    private String normaliseKey(String value) {
        return clean(value).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private String preferImported(String imported, String saved) {
        return clean(imported).isBlank() ? clean(saved) : clean(imported);
    }

    public AdminContactListContact updateContact(String loginId, String contactId, AdminContactListContact contact) {
        UUID id = parseId(contactId);
        int updated = jdbc.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    update admin_contact_list_contacts set
                        company = ?, contact_name = ?, email = ?, phone = ?, role = ?, segment = ?,
                        source = ?, owner = ?, stage = ?, date_added = ?, last_contact = ?,
                        next_action_date = ?, next_step = ?, package_name = ?, potential_mrr = ?,
                        notes = ?, category = ?, consent_status = ?,
                        has_valid_email = ?, is_duplicate = ?, edited = ?, issues_json = ?, updated_at = now()
                    where id = ? and login_id = ?
                    """);
            setContactValues(ps, contact, 1);
            ps.setObject(23, id);
            ps.setString(24, loginId);
            return ps;
        });
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found.");
        }
        jdbc.update("update admin_contact_list_workspaces set updated_at = now() where login_id = ?", loginId);
        return findContact(loginId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found."));
    }

    private List<AdminContactListContact> getContacts(String loginId) {
        return jdbc.query("""
                select id::text, company, contact_name, email, phone, role, segment, source,
                       owner, stage, date_added, last_contact, next_action_date, next_step,
                       package_name, potential_mrr, notes, category, consent_status, has_valid_email,
                       is_duplicate, edited, issues_json
                from admin_contact_list_contacts
                where login_id = ?
                order by row_order
                """, (rs, rowNum) -> mapContact(
                rs.getString("id"), rs.getString("company"), rs.getString("contact_name"),
                rs.getString("email"), rs.getString("phone"), rs.getString("role"),
                rs.getString("segment"), rs.getString("source"), rs.getString("owner"),
                rs.getString("stage"), rs.getString("date_added"), rs.getString("last_contact"),
                rs.getString("next_action_date"), rs.getString("next_step"),
                rs.getString("package_name"), rs.getString("potential_mrr"),
                rs.getString("notes"), rs.getString("category"),
                rs.getString("consent_status"), rs.getBoolean("has_valid_email"),
                rs.getBoolean("is_duplicate"), rs.getBoolean("edited"), rs.getString("issues_json")), loginId);
    }

    private Optional<AdminContactListContact> findContact(String loginId, UUID id) {
        return jdbc.query("""
                select id::text, company, contact_name, email, phone, role, segment, source,
                       owner, stage, date_added, last_contact, next_action_date, next_step,
                       package_name, potential_mrr, notes, category, consent_status, has_valid_email,
                       is_duplicate, edited, issues_json
                from admin_contact_list_contacts
                where login_id = ? and id = ?
                """, (rs, rowNum) -> mapContact(
                rs.getString("id"), rs.getString("company"), rs.getString("contact_name"),
                rs.getString("email"), rs.getString("phone"), rs.getString("role"),
                rs.getString("segment"), rs.getString("source"), rs.getString("owner"),
                rs.getString("stage"), rs.getString("date_added"), rs.getString("last_contact"),
                rs.getString("next_action_date"), rs.getString("next_step"),
                rs.getString("package_name"), rs.getString("potential_mrr"),
                rs.getString("notes"), rs.getString("category"),
                rs.getString("consent_status"), rs.getBoolean("has_valid_email"),
                rs.getBoolean("is_duplicate"), rs.getBoolean("edited"), rs.getString("issues_json")),
                loginId, id).stream().findFirst();
    }

    private AdminContactListContact mapContact(
            String id, String company, String name, String email, String phone, String role,
            String segment, String source, String owner, String stage, String dateAdded,
            String lastContact, String nextActionDate, String nextStep, String packageName,
            String potentialMrr, String notes, String category,
            String consentStatus, boolean hasValidEmail, boolean duplicate, boolean edited, String issuesJson) {
        try {
            return new AdminContactListContact(
                    id, company, name, email, phone, role, segment, source, owner, stage,
                    dateAdded, lastContact, nextActionDate, nextStep, packageName, potentialMrr, notes,
                    category, consentStatus, hasValidEmail, duplicate, edited,
                    objectMapper.readValue(issuesJson, STRING_LIST));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read saved contact quality issues.", e);
        }
    }

    private void setContactValues(PreparedStatement ps, AdminContactListContact contact, int startIndex)
            throws java.sql.SQLException {
        int index = startIndex;
        ps.setString(index++, clean(contact.company()));
        ps.setString(index++, clean(contact.name()));
        ps.setString(index++, clean(contact.email()));
        ps.setString(index++, clean(contact.phone()));
        ps.setString(index++, clean(contact.role()));
        ps.setString(index++, clean(contact.segment()));
        ps.setString(index++, clean(contact.source()));
        ps.setString(index++, clean(contact.owner()));
        ps.setString(index++, clean(contact.stage()));
        ps.setString(index++, clean(contact.dateAdded()));
        ps.setString(index++, clean(contact.lastContact()));
        ps.setString(index++, clean(contact.nextActionDate()));
        ps.setString(index++, clean(contact.nextStep()));
        ps.setString(index++, clean(contact.packageName()));
        ps.setString(index++, clean(contact.potentialMrr()));
        ps.setString(index++, clean(contact.notes()));
        ps.setString(index++, clean(contact.category()));
        ps.setString(index++, clean(contact.consentStatus()));
        ps.setBoolean(index++, contact.hasValidEmail());
        ps.setBoolean(index++, contact.isDuplicate());
        ps.setBoolean(index++, contact.edited());
        ps.setString(index, writeIssues(contact.issues()));
    }

    private String writeIssues(List<String> issues) {
        try {
            return objectMapper.writeValueAsString(issues == null ? List.of() : issues);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Could not save contact quality issues.", e);
        }
    }

    private UUID parseId(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found.");
        }
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private OffsetDateTime toOffsetDateTime(Timestamp value) {
        return value == null ? null : value.toInstant().atOffset(java.time.ZoneOffset.UTC);
    }

    private record WorkspaceMetadata(
            String fileName, Integer headerRow, OffsetDateTime importedAt, OffsetDateTime updatedAt) {
    }
}
