package com.nolyvra.app.service;

import com.nolyvra.app.model.ReminderCreateRequest;
import com.nolyvra.app.model.ReminderResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class ReminderService {

    private final JdbcTemplate jdbc;

    public ReminderService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<ReminderResponse> REMINDER_MAPPER = (rs, rowNum) -> {
        OffsetDateTime dueAt       = rs.getObject("due_at",       OffsetDateTime.class);
        OffsetDateTime completedAt = rs.getObject("completed_at", OffsetDateTime.class);
        OffsetDateTime createdAt   = rs.getObject("created_at",   OffsetDateTime.class);
        return new ReminderResponse(
                rs.getLong("id"),
                rs.getString("login_id"),
                rs.getString("candidate_id"),
                rs.getString("candidate_name"),
                rs.getString("title"),
                rs.getString("description"),
                rs.getString("reminder_type"),
                rs.getString("priority"),
                dueAt       != null ? dueAt.toInstant()       : null,
                rs.getBoolean("is_completed"),
                completedAt != null ? completedAt.toInstant() : null,
                createdAt   != null ? createdAt.toInstant()   : null);
    };

    // ─── GET /api/reminders ───────────────────────────────────────────────────

    public List<ReminderResponse> getReminders(String loginId, String filter) {
        String whereClause = switch (filter != null ? filter : "all") {
            case "today"    -> "and (r.due_at::date = now()::date or (r.due_at < now() and r.is_completed = false))";
            case "upcoming" -> "and r.due_at > now() and r.due_at <= now() + interval '7 days'";
            case "overdue"  -> "and r.due_at < now() and r.is_completed = false";
            default         -> "";
        };

        return jdbc.query("""
                select r.id, r.login_id, r.candidate_id,
                       c.name as candidate_name,
                       r.title, r.description, r.reminder_type,
                       r.priority, r.due_at, r.is_completed,
                       r.completed_at, r.created_at
                from reminders r
                left join candidates c on c.id = r.candidate_id
                where r.login_id = ?
                """ + whereClause + """
                \norder by r.is_completed asc, r.due_at asc
                """, REMINDER_MAPPER, loginId);
    }

    // ─── POST /api/reminders ──────────────────────────────────────────────────

    public ReminderResponse createReminder(ReminderCreateRequest req, String loginId) {
        OffsetDateTime dueAt = OffsetDateTime.ofInstant(req.dueAt(), ZoneOffset.UTC);

        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    insert into reminders (login_id, candidate_id, title, description,
                                           reminder_type, priority, due_at)
                    values (?, ?, ?, ?, 'MANUAL', ?, ?)
                    """, new String[]{"id"});
            ps.setString(1, loginId);
            ps.setString(2, req.candidateId());
            ps.setString(3, req.title());
            ps.setString(4, req.description());
            ps.setString(5, req.priority() != null ? req.priority() : "Normal");
            ps.setObject(6, dueAt);
            return ps;
        }, keys);

        Long newId = keys.getKey() != null ? keys.getKey().longValue() : null;
        return getReminderById(newId);
    }

    // ─── PATCH /api/reminders/{id}/complete ──────────────────────────────────

    public boolean markComplete(Long reminderId, String loginId) {
        int rows = jdbc.update("""
                update reminders
                set is_completed = true, completed_at = now()
                where id = ? and login_id = ?
                """, reminderId, loginId);
        return rows > 0;
    }

    // ─── DELETE /api/reminders/{id} ──────────────────────────────────────────

    public boolean deleteReminder(Long reminderId, String loginId) {
        int rows = jdbc.update(
                "delete from reminders where id = ? and login_id = ?",
                reminderId, loginId);
        return rows > 0;
    }

    // ─── Auto-scan (runs every 30 minutes) ───────────────────────────────────
    // Creates automatic reminders when pipeline conditions are met.

    @Scheduled(fixedRate = 1_800_000) // 30 minutes in ms
    public void autoScan() {
        try {
            autoReminderAnalysisPending();
            autoReminderScreeningStuck();
            autoReminderInterviewUpcoming();
            autoReminderFollowupPending();
        } catch (Exception e) {
            System.err.println("Auto-scan failed: " + e.getMessage());
        }
    }

    // 1. Analysis pending > 24h: candidate added but no analysis run
    private void autoReminderAnalysisPending() {
        jdbc.query("""
                select c.id as candidate_id, c.login_id, c.name, c.job_id
                from candidates c
                where c.created_at < now() - interval '24 hours'
                and not exists (
                    select 1 from analyses a where a.candidate_id = c.id
                )
                and not exists (
                    select 1 from reminders r
                    where r.candidate_id = c.id
                      and r.reminder_type = 'AUTO_ANALYSIS_PENDING'
                      and r.is_completed = false
                )
                """,
                (rs, rowNum) -> {
                    String candidateId = rs.getString("candidate_id");
                    String loginId     = rs.getString("login_id");
                    String name        = rs.getString("name");
                    jdbc.update("""
                            insert into reminders
                                (login_id, candidate_id, title, reminder_type, priority, due_at)
                            values (?, ?, ?, 'AUTO_ANALYSIS_PENDING', 'High', now())
                            """, loginId, candidateId,
                            "Run analysis for " + name + " — added over 24h ago");
                    return null;
                });
    }

    // 2. Candidate in Screening > 5 days
    private void autoReminderScreeningStuck() {
        jdbc.query("""
                select c.id as candidate_id, c.login_id, c.name
                from candidates c
                where c.stage = 'Screening'
                and c.updated_at < now() - interval '5 days'
                and not exists (
                    select 1 from reminders r
                    where r.candidate_id = c.id
                      and r.reminder_type = 'AUTO_SCREENING_STUCK'
                      and r.is_completed = false
                )
                """,
                (rs, rowNum) -> {
                    String candidateId = rs.getString("candidate_id");
                    String loginId     = rs.getString("login_id");
                    String name        = rs.getString("name");
                    jdbc.update("""
                            insert into reminders
                                (login_id, candidate_id, title, reminder_type, priority, due_at)
                            values (?, ?, ?, 'AUTO_SCREENING_STUCK', 'Normal', now())
                            """, loginId, candidateId,
                            name + " has been in Screening for over 5 days");
                    return null;
                });
    }

    // 3. Interview within 2 hours — notify recruiter
    private void autoReminderInterviewUpcoming() {
        jdbc.query("""
                select i.candidate_id, i.login_id, c.name, i.interview_type, i.scheduled_at
                from interviews i
                join candidates c on c.id = i.candidate_id
                where i.scheduled_at between now() and now() + interval '2 hours'
                and i.status = 'Scheduled'
                and not exists (
                    select 1 from reminders r
                    where r.candidate_id = i.candidate_id
                      and r.reminder_type = 'AUTO_INTERVIEW_UPCOMING'
                      and r.is_completed = false
                      and r.due_at::date = i.scheduled_at::date
                )
                """,
                (rs, rowNum) -> {
                    String candidateId = rs.getString("candidate_id");
                    String loginId     = rs.getString("login_id");
                    String name        = rs.getString("name");
                    String type        = rs.getString("interview_type");
                    OffsetDateTime scheduledAt = rs.getObject("scheduled_at", OffsetDateTime.class);
                    jdbc.update("""
                            insert into reminders
                                (login_id, candidate_id, title, reminder_type, priority, due_at)
                            values (?, ?, ?, 'AUTO_INTERVIEW_UPCOMING', 'High', ?)
                            """, loginId, candidateId,
                            "Interview with " + name + " (" + type + ") starting soon",
                            scheduledAt);
                    return null;
                });
    }

    // 4. Follow-up email not sent after interview completed
    private void autoReminderFollowupPending() {
        jdbc.query("""
                select i.candidate_id, i.login_id, c.name
                from interviews i
                join candidates c on c.id = i.candidate_id
                where i.scheduled_at < now() - interval '1 hour'
                and i.status = 'Scheduled'
                and not exists (
                    select 1 from email_history e
                    where e.candidate_id = i.candidate_id
                      and e.template_type = 'FOLLOW_UP'
                      and e.sent_at > i.scheduled_at
                )
                and not exists (
                    select 1 from reminders r
                    where r.candidate_id = i.candidate_id
                      and r.reminder_type = 'AUTO_FOLLOWUP_PENDING'
                      and r.is_completed = false
                )
                """,
                (rs, rowNum) -> {
                    String candidateId = rs.getString("candidate_id");
                    String loginId     = rs.getString("login_id");
                    String name        = rs.getString("name");
                    jdbc.update("""
                            insert into reminders
                                (login_id, candidate_id, title, reminder_type, priority, due_at)
                            values (?, ?, ?, 'AUTO_FOLLOWUP_PENDING', 'Normal', now() + interval '2 hours')
                            """, loginId, candidateId,
                            "Send follow-up email to " + name + " after interview");
                    return null;
                });
    }

    // ─── Internal helper ──────────────────────────────────────────────────────

    private ReminderResponse getReminderById(Long id) {
        return jdbc.query("""
                select r.id, r.login_id, r.candidate_id,
                       c.name as candidate_name,
                       r.title, r.description, r.reminder_type,
                       r.priority, r.due_at, r.is_completed,
                       r.completed_at, r.created_at
                from reminders r
                left join candidates c on c.id = r.candidate_id
                where r.id = ?
                """, REMINDER_MAPPER, id)
                .stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("Reminder not found after insert"));
    }
}
