package com.depthhire.app.service;

import com.depthhire.app.model.WorkflowResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Service
public class WorkflowService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public WorkflowService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    // ─── GET /api/candidates/{id}/workflow ────────────────────────────────────

    public WorkflowResponse getWorkflow(String candidateId, String loginId) {

        var rows = jdbc.query("""
                select c.id, c.name, c.email, c.linkedin_url, c.job_id, c.stage,
                       c.recruiter_notes, c.created_at,
                       j.title as job_title, j.company,
                       a.consistency_score, a.capability_score, a.risk_level
                from candidates c
                left join jobs j on j.id = c.job_id
                left join lateral (
                    select consistency_score, capability_score, risk_level
                    from analyses
                    where candidate_id = c.id
                    order by analyzed_at desc limit 1
                ) a on true
                where c.id = ? and c.login_id = ?
                """,
                (rs, r) -> {
                    OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);

                    // Use a plain HashMap — Map.of() is limited to 10 entries
                    Map<String, Object> m = new java.util.HashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("name", rs.getString("name"));
                    m.put("email", rs.getString("email") != null ? rs.getString("email") : "");
                    m.put("linkedinUrl", rs.getString("linkedin_url") != null ? rs.getString("linkedin_url") : "");
                    m.put("jobId", rs.getString("job_id"));
                    m.put("jobTitle", rs.getString("job_title") != null ? rs.getString("job_title") : "");
                    m.put("company", rs.getString("company") != null ? rs.getString("company") : "");
                    m.put("stage", rs.getString("stage") != null ? rs.getString("stage") : "Screening");
                    m.put("recruiterNotes",
                            rs.getString("recruiter_notes") != null ? rs.getString("recruiter_notes") : "");
                    m.put("consistencyScore", rs.getObject("consistency_score"));
                    m.put("capabilityScore", rs.getObject("capability_score"));
                    m.put("riskLevel", rs.getString("risk_level") != null ? rs.getString("risk_level") : "Low");
                    m.put("createdAt", odt != null ? odt.toInstant() : Instant.now());
                    return m;
                }, candidateId, loginId);

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Candidate not found: " + candidateId);
        }

        Map<String, Object> row = rows.get(0);
        List<WorkflowResponse.ActivityEvent> timeline = getTimeline(candidateId);

        return new WorkflowResponse(
                (String) row.get("id"),
                (String) row.get("name"),
                (String) row.get("email"),
                (String) row.get("linkedinUrl"),
                (String) row.get("jobId"),
                (String) row.get("jobTitle"),
                (String) row.get("company"),
                (String) row.get("stage"),
                (String) row.get("recruiterNotes"),
                row.get("consistencyScore") != null ? ((Number) row.get("consistencyScore")).intValue() : null,
                row.get("capabilityScore") != null ? ((Number) row.get("capabilityScore")).intValue() : null,
                (String) row.get("riskLevel"),
                (Instant) row.get("createdAt"),
                timeline);
    }

    // ─── Activity timeline ────────────────────────────────────────────────────

    public List<WorkflowResponse.ActivityEvent> getTimeline(String candidateId) {
        return jdbc.query("""
                select id, event_type, note, event_data, created_at
                from activity_timeline
                where candidate_id = ?
                order by created_at desc
                """,
                (rs, r) -> {
                    OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);
                    String eventType = rs.getString("event_type");
                    String note = rs.getString("note");
                    String desc = buildEventDescription(eventType, rs.getString("event_data"));
                    return new WorkflowResponse.ActivityEvent(
                            rs.getLong("id"),
                            eventType,
                            desc,
                            note,
                            odt != null ? odt.toInstant() : Instant.now());
                }, candidateId);
    }

    // ─── Insert timeline event (called by other services) ────────────────────

    public void recordEvent(String candidateId, String loginId,
            String eventType, String note, Object eventData) {
        try {
            String dataJson = eventData != null ? objectMapper.writeValueAsString(eventData) : null;
            jdbc.update("""
                    insert into activity_timeline (candidate_id, login_id, event_type, note, event_data)
                    values (?, ?, ?, ?, ?::jsonb)
                    """, candidateId, loginId, eventType, note, dataJson);
        } catch (Exception e) {
            // Non-critical — log but don't fail the main operation
            System.err.println("Failed to record timeline event: " + e.getMessage());
        }
    }

    // ─── Manual note ─────────────────────────────────────────────────────────

    public void addNote(String candidateId, String loginId, String note) {
        recordEvent(candidateId, loginId, "NOTE_ADDED", note, null);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String buildEventDescription(String eventType, String eventDataJson) {
        return switch (eventType) {
            case "CANDIDATE_ADDED" -> "Candidate added to pipeline";
            case "ANALYSIS_RUN" -> "AI analysis completed";
            case "STAGE_CHANGED" -> "Pipeline stage updated";
            case "EMAIL_SENT" -> "Email sent to candidate";
            case "INTERVIEW_SCHEDULED" -> "Interview scheduled";
            case "NOTE_ADDED" -> "Recruiter note added";
            case "MESSAGE_GENERATED" -> "AI message generated";
            default -> eventType.replace("_", " ");
        };
    }
}
