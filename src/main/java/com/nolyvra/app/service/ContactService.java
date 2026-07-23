package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateCreateRequest;
import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.ContactCreateRequest;
import com.nolyvra.app.model.ContactFromLeadRequest;
import com.nolyvra.app.model.ContactResponse;
import com.nolyvra.app.model.ContactUpdateRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
public class ContactService {

    private final JdbcTemplate jdbc;
    private final CandidateService candidateService;

    public ContactService(JdbcTemplate jdbc, CandidateService candidateService) {
        this.jdbc = jdbc;
        this.candidateService = candidateService;
    }

    private static final String SELECT_COLS = """
            SELECT ct.id, ct.client_id, ct.name, ct.title, ct.email, ct.phone,
                   ct.linkedin_url, ct.facebook_url, ct.twitter_url, ct.created_at, ct.candidate_id,
                   cl.company_name, cl.status, cl.industry, cl.location
            FROM contacts ct
            JOIN clients cl ON cl.id = ct.client_id
            """;

    private static final RowMapper<ContactResponse> MAPPER = (rs, i) -> {
        var ts = rs.getTimestamp("created_at");
        return new ContactResponse(
                rs.getLong("id"),
                rs.getLong("client_id"),
                rs.getString("company_name"),
                rs.getString("status"),
                rs.getString("industry"),
                rs.getString("location"),
                rs.getString("name"),
                rs.getString("title"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("linkedin_url"),
                rs.getString("facebook_url"),
                rs.getString("twitter_url"),
                ts != null ? ts.toInstant() : null,
                rs.getString("candidate_id"));
    };

    // ─── POST /api/contacts — add a contact to an existing client ────────────

    public ContactResponse createContact(ContactCreateRequest req, String loginId) {
        requireClientOwned(req.clientId(), loginId);

        Long id = jdbc.queryForObject("""
                INSERT INTO contacts (login_id, client_id, name, title, email, phone,
                    linkedin_url, facebook_url, twitter_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class,
                loginId, req.clientId(), req.name().trim(), req.title(), req.email(), req.phone(),
                req.linkedinUrl(), req.facebookUrl(), req.twitterUrl());

        return getContact(id, loginId);
    }

    // ─── POST /api/contacts/from-lead — from a Potential Client's decision maker ──
    // Finds (or creates, as a LEAD-status client) the company row, then adds the
    // contact against it. If that company is later added as a real client via
    // ClientService.convertLeadToClient, this same row just flips to CLIENT and
    // every contact linked to it reflects that automatically.

    public ContactResponse createContactFromLead(ContactFromLeadRequest req, String loginId) {
        List<Long> existing = jdbc.query(
                "SELECT id FROM clients WHERE login_id = ? AND lower(company_name) = lower(?)",
                (rs, i) -> rs.getLong("id"), loginId, req.companyName());

        Long clientId;
        if (!existing.isEmpty()) {
            clientId = existing.get(0);
        } else {
            clientId = jdbc.queryForObject("""
                    INSERT INTO clients (login_id, company_name, industry, location, linkedin_url, status)
                    VALUES (?, ?, ?, ?, ?, 'LEAD')
                    RETURNING id
                    """, Long.class,
                    loginId, req.companyName(), req.industry(), req.location(), req.linkedinUrl());
        }

        Long id = jdbc.queryForObject("""
                INSERT INTO contacts (login_id, client_id, name, title)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """, Long.class,
                loginId, clientId, req.name().trim(), req.title());

        return getContact(id, loginId);
    }

    // ─── PUT /api/contacts/{id} ───────────────────────────────────────────────

    public ContactResponse updateContact(Long id, ContactUpdateRequest req, String loginId) {
        int updated = jdbc.update("""
                UPDATE contacts SET
                    name = ?, title = ?, email = ?, phone = ?,
                    linkedin_url = ?, facebook_url = ?, twitter_url = ?,
                    updated_at = now()
                WHERE id = ? AND login_id = ?
                """,
                req.name().trim(), req.title(), req.email(), req.phone(),
                req.linkedinUrl(), req.facebookUrl(), req.twitterUrl(), id, loginId);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found: " + id);
        return getContact(id, loginId);
    }

    // ─── GET /api/contacts/{id} ───────────────────────────────────────────────

    public ContactResponse getContact(Long id, String loginId) {
        return jdbc.query(SELECT_COLS + " WHERE ct.id = ? AND ct.login_id = ?", MAPPER, id, loginId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found: " + id));
    }

    // ─── DELETE /api/contacts/{id} ────────────────────────────────────────────
    // Hard delete — no other table has a FK to contacts.id, and contacts has
    // no is_active column (unlike candidates/clients), so there's nothing to
    // soft-delete or repoint.

    public void deleteContact(Long id, String loginId) {
        int deleted = jdbc.update("DELETE FROM contacts WHERE id = ? AND login_id = ?", id, loginId);
        if (deleted == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found: " + id);
    }

    // ─── POST /api/contacts/{id}/link-candidate ──────────────────────────────
    // Creates a candidate record from this contact (via the existing unassigned-
    // candidate flow, no logic duplicated), flags it is_client = true, and links
    // the two rows together. Idempotent — calling it again just returns the
    // already-linked contact instead of creating a second candidate.

    public ContactResponse linkToCandidate(Long id, String loginId) {
        ContactResponse contact = getContact(id, loginId);
        if (contact.candidateId() != null) {
            return contact;
        }

        CandidateResponse candidate;
        try {
            candidate = candidateService.addCandidateUnassigned(
                    CandidateCreateRequest.builder()
                            .name(contact.name())
                            .email(contact.email())
                            .phone(contact.phone())
                            .build(),
                    loginId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }

        jdbc.update("UPDATE candidates SET is_client = true WHERE id = ?", candidate.id());
        jdbc.update("UPDATE contacts SET candidate_id = ?, updated_at = now() WHERE id = ?",
                candidate.id(), id);

        return getContact(id, loginId);
    }

    // ─── GET /api/contacts/by-candidate/{candidateId} — reverse lookup ───────

    public Optional<ContactResponse> getContactByCandidateId(String candidateId, String loginId) {
        return jdbc.query(SELECT_COLS + " WHERE ct.candidate_id = ? AND ct.login_id = ?",
                MAPPER, candidateId, loginId).stream().findFirst();
    }

    // ─── GET /api/contacts — all contacts for this tenant, across every client ──

    public List<ContactResponse> getAllContacts(String loginId) {
        return jdbc.query(SELECT_COLS + " WHERE ct.login_id = ? ORDER BY ct.created_at DESC",
                MAPPER, loginId);
    }

    // ─── GET /api/clients/{clientId}/contacts ────────────────────────────────

    public List<ContactResponse> getClientContacts(Long clientId, String loginId) {
        requireClientOwned(clientId, loginId);
        return jdbc.query(SELECT_COLS + " WHERE ct.client_id = ? AND ct.login_id = ? ORDER BY ct.created_at",
                MAPPER, clientId, loginId);
    }

    private void requireClientOwned(Long clientId, String loginId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clients WHERE id = ? AND login_id = ?",
                Integer.class, clientId, loginId);
        if (count == null || count == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found: " + clientId);
        }
    }
}
