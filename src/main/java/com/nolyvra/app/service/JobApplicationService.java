package com.nolyvra.app.service;

import com.nolyvra.app.model.JobApplicationResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Owns the job_applications table — the join between a Candidate (person) and
// a Job they've applied to. See additional/sql/V56__job_applications.sql.
// Other services (CandidateService, AnalysisService, WorkflowService,
// InterviewQuestionsService, InterviewTranscriptService) resolve "which
// application" through here instead of touching the table directly.
@Service
public class JobApplicationService {

    private final JdbcTemplate jdbc;

    public JobApplicationService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String SELECT_COLS = """
            SELECT ja.id, ja.candidate_id, ja.job_id, ja.stage, ja.interview_questions, ja.created_at,
                   j.title AS job_title, j.company AS job_company, j.status AS job_status
            FROM job_applications ja
            JOIN jobs j ON j.id = ja.job_id
            """;

    private static final RowMapper<JobApplicationResponse> MAPPER = (rs, i) -> {
        var ts = rs.getTimestamp("created_at");
        return new JobApplicationResponse(
                rs.getString("id"),
                rs.getString("candidate_id"),
                rs.getString("job_id"),
                rs.getString("job_title"),
                rs.getString("job_company"),
                rs.getString("job_status"),
                rs.getString("stage"),
                rs.getString("interview_questions"),
                ts != null ? ts.toInstant() : null);
    };

    // ─── Create ───────────────────────────────────────────────────────────────

    public JobApplicationResponse createApplication(String candidateId, String jobId, String loginId) {
        String id = "app-" + UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO job_applications (id, login_id, candidate_id, job_id)
                    VALUES (?, ?, ?, ?)
                    """, id, loginId, candidateId, jobId);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This candidate has already applied to this job.");
        }
        return getById(id, loginId).orElseThrow();
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    public Optional<JobApplicationResponse> getById(String id, String loginId) {
        return jdbc.query(SELECT_COLS + " WHERE ja.id = ? AND ja.login_id = ?", MAPPER, id, loginId)
                .stream().findFirst();
    }

    public List<JobApplicationResponse> getApplicationsForCandidate(String candidateId, String loginId) {
        return jdbc.query(SELECT_COLS + """
                 WHERE ja.candidate_id = ? AND ja.login_id = ? AND ja.is_active = true
                 ORDER BY ja.created_at DESC
                """, MAPPER, candidateId, loginId);
    }

    public List<JobApplicationResponse> getApplicationsForJob(String jobId, String loginId) {
        return jdbc.query(SELECT_COLS + """
                 WHERE ja.job_id = ? AND ja.login_id = ? AND ja.is_active = true
                 ORDER BY ja.created_at DESC
                """, MAPPER, jobId, loginId);
    }

    // The compatibility shim used by every existing (job-agnostic) candidate
    // route: "which application should a single-job view show?" — the most
    // recently created active one.
    public Optional<JobApplicationResponse> getMostRecentActiveApplication(String candidateId, String loginId) {
        return jdbc.query(SELECT_COLS + """
                 WHERE ja.candidate_id = ? AND ja.login_id = ? AND ja.is_active = true
                 ORDER BY ja.created_at DESC
                 LIMIT 1
                """, MAPPER, candidateId, loginId)
                .stream().findFirst();
    }

    public Optional<JobApplicationResponse> getApplicationForJob(String candidateId, String jobId, String loginId) {
        return jdbc.query(SELECT_COLS + " WHERE ja.candidate_id = ? AND ja.job_id = ? AND ja.login_id = ?",
                MAPPER, candidateId, jobId, loginId).stream().findFirst();
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public void updateStage(String id, String stage, String loginId) {
        int updated = jdbc.update(
                "UPDATE job_applications SET stage = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                stage, id, loginId);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found: " + id);
    }

    public void updateInterviewQuestions(String id, String questions, String loginId) {
        int updated = jdbc.update(
                "UPDATE job_applications SET interview_questions = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                questions, id, loginId);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found: " + id);
    }
}
