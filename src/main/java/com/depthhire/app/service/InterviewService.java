package com.depthhire.app.service;

import com.depthhire.app.model.InterviewResponse;
import com.depthhire.app.model.InterviewScheduleRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class InterviewService {

    private final JdbcTemplate jdbc;
    private final WorkflowService workflowService;

    public InterviewService(JdbcTemplate jdbc, WorkflowService workflowService) {
        this.jdbc = jdbc;
        this.workflowService = workflowService;
    }

    private static final RowMapper<InterviewResponse> INTERVIEW_MAPPER = (rs, rowNum) -> {
        OffsetDateTime scheduledAt = rs.getObject("scheduled_at", OffsetDateTime.class);
        OffsetDateTime createdAt   = rs.getObject("created_at",   OffsetDateTime.class);
        return new InterviewResponse(
                rs.getString("id"),
                rs.getString("candidate_id"),
                rs.getString("candidate_name"),
                rs.getString("job_id"),
                rs.getString("job_title"),
                rs.getString("company"),
                rs.getString("interviewer"),
                rs.getString("interview_type"),
                scheduledAt != null ? scheduledAt.toInstant() : null,
                rs.getObject("duration_minutes") != null ? rs.getInt("duration_minutes") : null,
                rs.getString("location"),
                rs.getString("meeting_link"),
                rs.getString("notes"),
                rs.getString("status"),
                createdAt != null ? createdAt.toInstant() : null);
    };

    // ─── POST /api/interviews/schedule ────────────────────────────────────────

    public InterviewResponse scheduleInterview(InterviewScheduleRequest req, String loginId) {
        String id = "int-" + UUID.randomUUID();

        OffsetDateTime scheduledAt = OffsetDateTime.ofInstant(req.scheduledAt(), ZoneOffset.UTC);

        jdbc.update("""
                insert into interviews (
                    id, candidate_id, job_id, login_id, interviewer, interview_type,
                    scheduled_at, duration_minutes, location, meeting_link, notes, status
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled')
                """,
                id, req.candidateId(), req.jobId(), loginId,
                req.interviewer(), req.interviewType(),
                scheduledAt,
                req.durationMinutes() != null ? req.durationMinutes() : 60,
                req.location(), req.meetingLink(), req.notes());

        // Record timeline event
        workflowService.recordEvent(req.candidateId(), loginId, "INTERVIEW_SCHEDULED",
                "Interview scheduled: " + req.interviewType(), null);

        return getInterview(id, loginId);
    }

    // ─── GET /api/interviews ─────────────────────────────────────────────────

    public List<InterviewResponse> getScheduledInterviews(String loginId) {
        return jdbc.query("""
                select i.id, i.candidate_id, c.name as candidate_name,
                       i.job_id, j.title as job_title, j.company,
                       i.interviewer, i.interview_type, i.scheduled_at,
                       i.duration_minutes, i.location, i.meeting_link,
                       i.notes, i.status, i.created_at
                from interviews i
                join candidates c on c.id = i.candidate_id
                join jobs j on j.id = i.job_id
                where i.login_id = ?
                order by i.scheduled_at asc
                """, INTERVIEW_MAPPER, loginId);
    }

    // ─── GET /api/interviews/candidate/{id} ──────────────────────────────────

    public List<InterviewResponse> getInterviewsForCandidate(String candidateId, String loginId) {
        return jdbc.query("""
                select i.id, i.candidate_id, c.name as candidate_name,
                       i.job_id, j.title as job_title, j.company,
                       i.interviewer, i.interview_type, i.scheduled_at,
                       i.duration_minutes, i.location, i.meeting_link,
                       i.notes, i.status, i.created_at
                from interviews i
                join candidates c on c.id = i.candidate_id
                join jobs j on j.id = i.job_id
                where i.candidate_id = ? and i.login_id = ?
                order by i.scheduled_at asc
                """, INTERVIEW_MAPPER, candidateId, loginId);
    }

    // ─── PATCH /api/interviews/{id}/cancel ───────────────────────────────────

    public boolean cancelInterview(String interviewId, String loginId) {
        int rows = jdbc.update("""
                update interviews set status = 'Cancelled'
                where id = ? and login_id = ?
                """, interviewId, loginId);
        return rows > 0;
    }

    // ─── Internal getter ──────────────────────────────────────────────────────

    private InterviewResponse getInterview(String id, String loginId) {
        return jdbc.query("""
                select i.id, i.candidate_id, c.name as candidate_name,
                       i.job_id, j.title as job_title, j.company,
                       i.interviewer, i.interview_type, i.scheduled_at,
                       i.duration_minutes, i.location, i.meeting_link,
                       i.notes, i.status, i.created_at
                from interviews i
                join candidates c on c.id = i.candidate_id
                join jobs j on j.id = i.job_id
                where i.id = ?
                """, INTERVIEW_MAPPER, id)
                .stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("Interview not found after insert: " + id));
    }
}
