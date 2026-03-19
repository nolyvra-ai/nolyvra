package com.depthhire.app.service;

import com.depthhire.app.model.CandidateCreateRequest;
import com.depthhire.app.model.CandidateResponse;
import com.depthhire.app.model.StageUpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class CandidateService {

    private final JdbcTemplate jdbc;

    public CandidateService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<CandidateResponse> CANDIDATE_MAPPER = (rs, rowNum) -> {
        OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);
        return new CandidateResponse(
                rs.getString("id"),
                rs.getString("job_id"),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("linkedin_url"),
                odt != null ? odt.toInstant() : null,
                rs.getString("stage"));
    };

    // ─── Create ───────────────────────────────────────────────────────────────

    public CandidateResponse addCandidate(String jobId, CandidateCreateRequest req, String loginId) {
        String id = "cand-" + UUID.randomUUID();
        jdbc.update("""
                insert into candidates
                    (id, job_id, login_id, name, email, linkedin_url, cv_text, stage, is_active)
                values (?, ?, ?, ?, ?, ?, ?, 'Screening', true)
                """,
                id, jobId, loginId,
                req.name(), req.email(), req.linkedinUrl(), req.cvText());

        return new CandidateResponse(id, jobId, req.name(), req.email(),
                req.linkedinUrl(), Instant.now(), "Screening");
    }

    // Create candidate without job assignment (job_id = null — "Not Assigned")
    public CandidateResponse addCandidateUnassigned(CandidateCreateRequest req, String loginId) {
        String id = "cand-" + UUID.randomUUID();
        jdbc.update("""
                insert into candidates
                    (id, job_id, login_id, name, email, linkedin_url, cv_text, stage, is_active)
                values (?, null, ?, ?, ?, ?, ?, 'Screening', true)
                """,
                id, loginId,
                req.name(), req.email(), req.linkedinUrl(), req.cvText());

        return new CandidateResponse(id, null, req.name(), req.email(),
                req.linkedinUrl(), Instant.now(), "Screening");
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    public Optional<CandidateResponse> getCandidate(String candidateId, String loginId) {
        return jdbc.query("""
                select id, job_id, name, email, linkedin_url, created_at, stage
                from candidates
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, CANDIDATE_MAPPER, candidateId, loginId).stream().findFirst();
    }

    public List<CandidateResponse> getCandidatesByJob(String jobId, String loginId) {
        return jdbc.query("""
                select id, job_id, name, email, linkedin_url, created_at, stage
                from candidates
                where job_id = ?
                  and login_id = ?
                  and is_active = true
                order by created_at desc
                """, CANDIDATE_MAPPER, jobId, loginId);
    }

    public List<CandidateResponse> getAllCandidates(String loginId) {
        return jdbc.query("""
                select id, job_id, name, email, linkedin_url, created_at, stage
                from candidates
                where login_id = ?
                  and is_active = true
                order by created_at desc
                """, CANDIDATE_MAPPER, loginId);
    }

    // ─── Update stage ─────────────────────────────────────────────────────────

    public boolean updateStage(String candidateId, StageUpdateRequest req, String loginId) {
        int rows = jdbc.update("""
                update candidates
                set stage = ?,
                    recruiter_notes = coalesce(?, recruiter_notes),
                    updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """,
                req.stage(), req.recruiterNotes(), candidateId, loginId);
        return rows > 0;
    }

    // ─── Update notes ─────────────────────────────────────────────────────────

    public boolean updateNotes(String candidateId, String notes, String loginId) {
        int rows = jdbc.update("""
                update candidates
                set recruiter_notes = ?,
                    updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, notes, candidateId, loginId);
        return rows > 0;
    }

    // ─── Soft delete ──────────────────────────────────────────────────────────
    // Sets is_active = false instead of physically deleting the row.
    // All analyses, timeline events and email history linked to the candidate
    // are preserved in the DB for audit purposes.

    public boolean deleteCandidate(String candidateId, String loginId) {
        int rows = jdbc.update("""
                update candidates
                set is_active = false,
                    updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, candidateId, loginId);
        return rows > 0;
    }
}