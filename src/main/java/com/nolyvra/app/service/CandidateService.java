package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateCreateRequest;
import com.nolyvra.app.model.CandidateListItemResponse;
import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.StageUpdateRequest;
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
                rs.getString("phone_number"),
                rs.getString("linkedin_url"),
                odt != null ? odt.toInstant() : null,
                rs.getString("stage"),
                rs.getString("cv_text"));
    };

    private static final RowMapper<CandidateListItemResponse> CANDIDATE_LIST_MAPPER = (rs, rowNum) -> {
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        Long analysisId = (Long) rs.getObject("analysis_id");
        return new CandidateListItemResponse(
                rs.getString("id"),
                rs.getString("job_id"),
                rs.getString("job_title"),
                rs.getString("job_company"),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("linkedin_url"),
                createdAt != null ? createdAt.toInstant() : null,
                rs.getString("stage"),
                (Integer) rs.getObject("consistency_score"),
                (Integer) rs.getObject("capability_score"),
                rs.getString("risk_level"),
                (Integer) rs.getObject("timeline_match_percent"),
                analysisId != null ? "Analysed" : "Pending");
    };

    // ─── Duplicate check ──────────────────────────────────────────────────────

    public boolean isDuplicate(String jobId, String name, String loginId) {
        String sql = jobId != null
            ? """
              select count(*) from candidates
              where job_id = ? and login_id = ? and is_active = true
              and lower(trim(name)) = lower(trim(?))
              """
            : """
              select count(*) from candidates
              where job_id is null and login_id = ? and is_active = true
              and lower(trim(name)) = lower(trim(?))
              """;
        Integer count = jobId != null
            ? jdbc.queryForObject(sql, Integer.class, jobId, loginId, name)
            : jdbc.queryForObject(sql, Integer.class, loginId, name);
        return count != null && count > 0;
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    public CandidateResponse addCandidate(String jobId, CandidateCreateRequest req, String loginId) {
        if (isDuplicate(jobId, req.name(), loginId)) {
            throw new IllegalStateException(
                req.name() + " is already in the pipeline for this job.");
        }
        String id = "cand-" + UUID.randomUUID();
        jdbc.update("""
                insert into candidates
                    (id, job_id, login_id, name, email, phone_number, linkedin_url, cv_text, stage, is_active)
                values (?, ?, ?, ?, ?, ?, ?, ?, 'Screening', true)
                """,
                id, jobId, loginId,
                req.name(), req.email(), req.phone(), req.linkedinUrl(), req.cvText());

        return new CandidateResponse(id, jobId, req.name(), req.email(),
                req.phone(), req.linkedinUrl(), Instant.now(), "Screening", req.cvText());
    }

    // Create candidate without job assignment (job_id = null — "Not Assigned")
    public CandidateResponse addCandidateUnassigned(CandidateCreateRequest req, String loginId) {
        if (isDuplicate(null, req.name(), loginId)) {
            throw new IllegalStateException(
                req.name() + " is already in the pipeline as an unassigned candidate.");
        }
        String id = "cand-" + UUID.randomUUID();
        jdbc.update("""
                insert into candidates
                    (id, job_id, login_id, name, email, phone_number, linkedin_url, cv_text, stage, is_active)
                values (?, null, ?, ?, ?, ?, ?, ?, 'Screening', true)
                """,
                id, loginId,
                req.name(), req.email(), req.phone(), req.linkedinUrl(), req.cvText());

        return new CandidateResponse(id, null, req.name(), req.email(),
                req.phone(), req.linkedinUrl(), Instant.now(), "Screening", req.cvText());
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    public Optional<CandidateResponse> getCandidate(String candidateId, String loginId) {
        return jdbc.query("""
                select id, job_id, name, email, phone_number, linkedin_url, created_at, stage, cv_text
                from candidates
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, CANDIDATE_MAPPER, candidateId, loginId).stream().findFirst();
    }

    public List<CandidateResponse> getCandidatesByJob(String jobId, String loginId) {
        return jdbc.query("""
                select id, job_id, name, email, phone_number, linkedin_url, created_at, stage, cv_text
                from candidates
                where job_id = ?
                  and login_id = ?
                  and is_active = true
                order by created_at desc
                """, CANDIDATE_MAPPER, jobId, loginId);
    }

    public List<CandidateResponse> getAllCandidates(String loginId) {
        return jdbc.query("""
                select id, job_id, name, email, phone_number, linkedin_url, created_at, stage, cv_text
                from candidates
                where login_id = ?
                  and is_active = true
                order by created_at desc
                """, CANDIDATE_MAPPER, loginId);
    }

    public List<CandidateListItemResponse> getCandidateList(String loginId) {
        return jdbc.query("""
                select c.id, c.job_id, c.name, c.email, c.linkedin_url, c.created_at, c.stage,
                       coalesce(j.title, 'Not Assigned') as job_title,
                       coalesce(j.company, '') as job_company,
                       a.id as analysis_id,
                       a.consistency_score,
                       a.capability_score,
                       a.risk_level,
                       a.timeline_match_percent
                from candidates c
                left join jobs j on j.id = c.job_id
                left join lateral (
                    select id, consistency_score, capability_score, risk_level, timeline_match_percent
                    from analyses
                    where candidate_id = c.id
                      and login_id = c.login_id
                    order by analyzed_at desc
                    limit 1
                ) a on true
                where c.login_id = ?
                  and c.is_active = true
                order by c.created_at desc
                """, CANDIDATE_LIST_MAPPER, loginId);
    }

    public int getActiveCandidateCount(String loginId) {
        Integer count = jdbc.queryForObject("""
                select count(*)
                from candidates
                where login_id = ?
                  and is_active = true
                """, Integer.class, loginId);
        return count != null ? count : 0;
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
