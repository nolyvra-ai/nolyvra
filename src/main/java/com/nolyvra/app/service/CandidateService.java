package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateCreateRequest;
import com.nolyvra.app.model.CandidateListItemResponse;
import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.CandidateUpdateRequest;
import com.nolyvra.app.model.JobApplicationResponse;
import com.nolyvra.app.model.StageUpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class CandidateService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final JobApplicationService jobApplicationService;
    private final CandidateImportService candidateImportService;

    public CandidateService(JdbcTemplate jdbc, ObjectMapper objectMapper,
                             JobApplicationService jobApplicationService,
                             CandidateImportService candidateImportService) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.jobApplicationService = jobApplicationService;
        this.candidateImportService = candidateImportService;
    }

    private String skillsToJson(List<String> skills) {
        try {
            return objectMapper.writeValueAsString(skills != null ? skills : List.of());
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> parseSkills(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            var node = objectMapper.readTree(json);
            List<String> skills = new ArrayList<>();
            if (node.isArray()) {
                node.forEach(s -> skills.add(s.asText()));
            }
            return skills;
        } catch (Exception e) {
            return List.of();
        }
    }

    private final RowMapper<CandidateResponse> CANDIDATE_MAPPER = (rs, rowNum) -> {
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
                rs.getString("cv_text"),
                parseSkills(rs.getString("skills")),
                rs.getString("current_title"),
                rs.getString("location"),
                rs.getString("state"),
                rs.getBigDecimal("years_experience"),
                rs.getString("seniority_level"),
                rs.getBigDecimal("expected_salary_min"),
                rs.getBigDecimal("expected_salary_max"),
                rs.getString("salary_currency"),
                (Integer) rs.getObject("notice_period_weeks"),
                rs.getString("work_rights"),
                (Boolean) rs.getObject("remote_flexible"),
                (Boolean) rs.getObject("is_client"));
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

    // Same check, but excludes the candidate's own row — used when editing an
    // existing candidate so a rename/job-assignment doesn't flag itself.
    private boolean isDuplicateExcluding(String jobId, String name, String loginId, String excludeCandidateId) {
        String sql = jobId != null
            ? """
              select count(*) from candidates
              where job_id = ? and login_id = ? and is_active = true
              and lower(trim(name)) = lower(trim(?)) and id <> ?
              """
            : """
              select count(*) from candidates
              where job_id is null and login_id = ? and is_active = true
              and lower(trim(name)) = lower(trim(?)) and id <> ?
              """;
        Integer count = jobId != null
            ? jdbc.queryForObject(sql, Integer.class, jobId, loginId, name, excludeCandidateId)
            : jdbc.queryForObject(sql, Integer.class, loginId, name, excludeCandidateId);
        return count != null && count > 0;
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    // candidates.job_id / stage act as a cache of the person's most recently
    // created active application — kept in sync on every write so every
    // existing (job-agnostic) read path keeps working unchanged. The
    // job_applications table is the source of truth for "all applications";
    // see additional/sql/V56__job_applications.sql.
    public CandidateResponse addCandidate(String jobId, CandidateCreateRequest req, String loginId) {
        String existingId = candidateImportService.findExistingCandidateId(
                loginId, req.name(), req.email(), req.phone(), null, req.state(), req.currentTitle());

        if (existingId != null) {
            if (jobApplicationService.getApplicationForJob(existingId, jobId, loginId).isPresent()) {
                throw new IllegalStateException(
                    req.name() + " is already in the pipeline for this job.");
            }
            jobApplicationService.createApplication(existingId, jobId, loginId);
            jdbc.update("""
                    update candidates
                    set job_id = ?, stage = 'Screening', updated_at = now()
                    where id = ? and login_id = ?
                    """, jobId, existingId, loginId);
            return getCandidate(existingId, loginId).orElseThrow();
        }

        if (isDuplicate(jobId, req.name(), loginId)) {
            throw new IllegalStateException(
                req.name() + " is already in the pipeline for this job.");
        }
        String id = "cand-" + UUID.randomUUID();
        jdbc.update("""
                insert into candidates
                    (id, job_id, login_id, name, email, phone_number, linkedin_url, cv_text, stage, is_active,
                     skills, current_title, location, state, years_experience, seniority_level,
                     expected_salary_min, expected_salary_max, salary_currency,
                     notice_period_weeks, work_rights, remote_flexible)
                values (?, ?, ?, ?, ?, ?, ?, ?, 'Screening', true, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, jobId, loginId,
                req.name(), req.email(), req.phone(), req.linkedinUrl(), req.cvText(),
                skillsToJson(req.skills()),
                req.currentTitle(), req.location(), req.state(), req.yearsExperience(), req.seniorityLevel(),
                req.expectedSalaryMin(), req.expectedSalaryMax(), req.salaryCurrency(),
                req.noticePeriodWeeks(), req.workRights(), req.remoteFlexible());
        jobApplicationService.createApplication(id, jobId, loginId);

        return new CandidateResponse(id, jobId, req.name(), req.email(),
                req.phone(), req.linkedinUrl(), Instant.now(), "Screening", req.cvText(), req.skills(),
                req.currentTitle(), req.location(), req.state(), req.yearsExperience(), req.seniorityLevel(),
                req.expectedSalaryMin(), req.expectedSalaryMax(), req.salaryCurrency(),
                req.noticePeriodWeeks(), req.workRights(), req.remoteFlexible(), false);
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
                    (id, job_id, login_id, name, email, phone_number, linkedin_url, cv_text, stage, is_active,
                     skills, current_title, location, state, years_experience, seniority_level,
                     expected_salary_min, expected_salary_max, salary_currency,
                     notice_period_weeks, work_rights, remote_flexible)
                values (?, null, ?, ?, ?, ?, ?, ?, 'Screening', true, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, loginId,
                req.name(), req.email(), req.phone(), req.linkedinUrl(), req.cvText(),
                skillsToJson(req.skills()),
                req.currentTitle(), req.location(), req.state(), req.yearsExperience(), req.seniorityLevel(),
                req.expectedSalaryMin(), req.expectedSalaryMax(), req.salaryCurrency(),
                req.noticePeriodWeeks(), req.workRights(), req.remoteFlexible());

        return new CandidateResponse(id, null, req.name(), req.email(),
                req.phone(), req.linkedinUrl(), Instant.now(), "Screening", req.cvText(), req.skills(),
                req.currentTitle(), req.location(), req.state(), req.yearsExperience(), req.seniorityLevel(),
                req.expectedSalaryMin(), req.expectedSalaryMax(), req.salaryCurrency(),
                req.noticePeriodWeeks(), req.workRights(), req.remoteFlexible(), false);
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    private static final String CANDIDATE_COLUMNS = """
            id, job_id, name, email, phone_number, linkedin_url, created_at, stage, cv_text, skills,
            current_title, location, state, years_experience, seniority_level,
            expected_salary_min, expected_salary_max, salary_currency,
            notice_period_weeks, work_rights, remote_flexible, is_client
            """;

    public Optional<CandidateResponse> getCandidate(String candidateId, String loginId) {
        return jdbc.query("""
                select %s
                from candidates
                where id = ?
                  and login_id = ?
                  and is_active = true
                """.formatted(CANDIDATE_COLUMNS), CANDIDATE_MAPPER, candidateId, loginId).stream().findFirst();
    }

    // Lists everyone with an active application to this job — via
    // job_applications, not the candidates.job_id cache, since a person can
    // now have applications to other jobs that are more recent (and so
    // "win" the cache). jobId/stage in the response reflect THIS job's
    // application, not the person's cached most-recent one.
    public List<CandidateResponse> getCandidatesByJob(String jobId, String loginId) {
        return jdbc.query("""
                select c.id, ja.job_id, c.name, c.email, c.phone_number, c.linkedin_url, c.created_at, ja.stage,
                       c.cv_text, c.skills, c.current_title, c.location, c.state, c.years_experience,
                       c.seniority_level, c.expected_salary_min, c.expected_salary_max, c.salary_currency,
                       c.notice_period_weeks, c.work_rights, c.remote_flexible, c.is_client
                from job_applications ja
                join candidates c on c.id = ja.candidate_id
                where ja.job_id = ?
                  and ja.login_id = ?
                  and ja.is_active = true
                  and c.is_active = true
                order by ja.created_at desc
                """, CANDIDATE_MAPPER, jobId, loginId);
    }

    public List<CandidateResponse> getAllCandidates(String loginId) {
        return jdbc.query("""
                select %s
                from candidates
                where login_id = ?
                  and is_active = true
                order by created_at desc
                """.formatted(CANDIDATE_COLUMNS), CANDIDATE_MAPPER, loginId);
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

    // ─── Update profile (Edit Profile) ─────────────────────────────────────────
    // Job assignment can only change here while the candidate's current job is
    // unassigned, or no longer open (not Active/Fulfilling) — e.g. once a job
    // is Filled/Closed, the candidate can be moved onto a new job. While the
    // current job is still Active/Fulfilling, reassignment is blocked; the
    // frontend instead offers "Add Candidate to Another Job" (a separate
    // candidate record via addCandidate, not this method).

    private boolean isJobOpen(String jobId, String loginId) {
        if (jobId == null) return false;
        String status = jdbc.query(
                "select status from jobs where id = ? and login_id = ?",
                (rs, rowNum) -> rs.getString("status"), jobId, loginId)
                .stream().findFirst().orElse(null);
        return status != null && ("active".equalsIgnoreCase(status) || "fulfilling".equalsIgnoreCase(status));
    }

    // Finds or creates the job_applications row for (candidateId, jobId) —
    // used wherever a candidate is pointed at a job (new or reassigned) so
    // job_applications stays the source of truth alongside the
    // candidates.job_id/stage cache.
    private JobApplicationResponse ensureApplication(String candidateId, String jobId, String loginId) {
        return jobApplicationService.getApplicationForJob(candidateId, jobId, loginId)
                .orElseGet(() -> jobApplicationService.createApplication(candidateId, jobId, loginId));
    }

    public Optional<CandidateResponse> updateCandidate(String candidateId, CandidateUpdateRequest req, String loginId) {
        Optional<CandidateResponse> existing = getCandidate(candidateId, loginId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        String currentJobId = existing.get().jobId();
        String effectiveJobId = isJobOpen(currentJobId, loginId) ? currentJobId : req.jobId();

        if (effectiveJobId != null && !effectiveJobId.equals(currentJobId)) {
            ensureApplication(candidateId, effectiveJobId, loginId);
        }

        if (isDuplicateExcluding(effectiveJobId, req.name(), loginId, candidateId)) {
            throw new IllegalStateException(
                req.name() + " is already in the pipeline for that job.");
        }

        jdbc.update("""
                update candidates
                set job_id = ?, name = ?, email = ?, phone_number = ?, linkedin_url = ?, cv_text = ?,
                    current_title = ?, location = ?, state = ?, years_experience = ?, seniority_level = ?,
                    expected_salary_min = ?, expected_salary_max = ?, salary_currency = ?,
                    notice_period_weeks = ?, work_rights = ?, remote_flexible = ?,
                    updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """,
                effectiveJobId, req.name(), req.email(), req.phone(), req.linkedinUrl(), req.cvText(),
                req.currentTitle(), req.location(), req.state(), req.yearsExperience(), req.seniorityLevel(),
                req.expectedSalaryMin(), req.expectedSalaryMax(), req.salaryCurrency(),
                req.noticePeriodWeeks(), req.workRights(), req.remoteFlexible(),
                candidateId, loginId);

        return getCandidate(candidateId, loginId);
    }

    // ─── Update stage ─────────────────────────────────────────────────────────

    public boolean updateStage(String candidateId, StageUpdateRequest req, String loginId) {
        jobApplicationService.getMostRecentActiveApplication(candidateId, loginId)
                .ifPresent(app -> jobApplicationService.updateStage(app.id(), req.stage(), loginId));

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

    // ─── Applications (Candidate <-> Job, many-to-many) ────────────────────────

    public List<JobApplicationResponse> getApplications(String candidateId, String loginId) {
        return jobApplicationService.getApplicationsForCandidate(candidateId, loginId);
    }

    // Applies an existing candidate to another job — creates the
    // job_applications row and points the candidates.job_id/stage cache at
    // it (same "most recent" semantics as addCandidate).
    public CandidateResponse addApplication(String candidateId, String jobId, String loginId) {
        Optional<CandidateResponse> existing = getCandidate(candidateId, loginId);
        if (existing.isEmpty()) {
            throw new IllegalStateException("Candidate not found: " + candidateId);
        }
        if (jobApplicationService.getApplicationForJob(candidateId, jobId, loginId).isPresent()) {
            throw new IllegalStateException(
                existing.get().name() + " is already in the pipeline for this job.");
        }
        jobApplicationService.createApplication(candidateId, jobId, loginId);
        jdbc.update("""
                update candidates
                set job_id = ?, stage = 'Screening', updated_at = now()
                where id = ? and login_id = ?
                """, jobId, candidateId, loginId);
        return getCandidate(candidateId, loginId).orElseThrow();
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
