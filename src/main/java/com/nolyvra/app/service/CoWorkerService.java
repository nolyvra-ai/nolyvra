package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class CoWorkerService {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final String model;
    private final TokenService tokenService;
    private final AnalysisService analysisService; // Change 1: added

    public CoWorkerService(
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            JdbcTemplate jdbc,
            TokenService tokenService,
            @Lazy AnalysisService analysisService, // Change 1: added (@Lazy avoids circular dependency)
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.jdbc = jdbc;
        this.tokenService = tokenService;
        this.analysisService = analysisService; // Change 1: added
        this.model = model;
    }

    // ─── Main chat endpoint ───────────────────────────────────────────────────

    public CoWorkerChatResponse chat(String loginId, CoWorkerChatRequest request) {
        String context = buildContext(loginId);
        persistMessage(loginId, "user", request.message());

        String systemPrompt = """
                You are nolyvra Co-worker AI — a helpful recruitment assistant that takes actions inside the app.

                You have access to the following recruitment data for this recruiter:
                %s

                When the user asks you to do something, you MUST return EXACTLY ONE JSON object:
                {
                  "message": "<friendly conversational reply, briefly confirm what you found and what you plan to do>",
                  "pendingAction": {
                    "type": "RUN_ANALYSIS|SCHEDULE_INTERVIEW|RESCHEDULE_AND_NOTIFY|MOVE_PIPELINE|EMAIL|CREATE_REMINDER|NONE",
                    "description": "<1-sentence human-readable action description>",
                    "params": { <action-specific parameters — see below> }
                  }
                }

                Set pendingAction.type to "NONE" and params to {} if the message is just a question or greeting.

                Parameter schemas per action type:

                RUN_ANALYSIS:
                  { "candidateIds": ["cand-xxx", ...], "candidateNames": ["Name", ...], "jobTitle": "..." }

                SCHEDULE_INTERVIEW:
                  { "candidateId": "cand-xxx", "candidateName": "...", "interviewType": "Phone Screen|Video Interview|In-Person", "scheduledAt": "ISO datetime or null if not specified", "notes": "..." }

                RESCHEDULE_AND_NOTIFY:
                  { "interviewId": "int-xxx or null", "candidateId": "cand-xxx", "candidateName": "...", "interviewType": "...", "newScheduledAt": "ISO datetime or null", "notes": "..." }
                  Use this for any reschedule request, or multi-step (reschedule + notify candidate + next available slots).

                MOVE_PIPELINE:
                  { "candidateIds": ["cand-xxx", ...], "candidateNames": ["Name", ...], "toStage": "Screening|Interview|Assessment|Offer|Selected|Rejected", "jobTitle": "..." }

                EMAIL:
                  { "candidateId": "cand-xxx", "candidateName": "...", "emailType": "FOLLOW_UP|INTERVIEW_INVITE|REJECTION|OFFER", "subject": "suggested subject", "body": "suggested email body" }
                  NOTE: For email actions, the app will navigate to the email centre page with fields pre-populated. No email is sent automatically.

                CREATE_REMINDER:
                  { "title": "...", "candidateId": "cand-xxx or null", "dueAt": "ISO datetime", "priority": "High|Normal|Low" }

                Rules:
                - Always match candidate and job names to real IDs from the context above.
                - If you cannot find a match, say so in the message and set pendingAction type to NONE.
                - For EMAIL actions, always mention in your message that you will take the user to the email page.
                - For questions about upcoming meetings or free time, answer directly from UPCOMING INTERVIEWS data above — set pendingAction to NONE.
                - For reschedule + notify + next slots requests, always use RESCHEDULE_AND_NOTIFY (not SCHEDULE_INTERVIEW).
                - Keep your message friendly, concise and specific (mention names and counts).
                - No markdown. No extra keys.
                - CRITICAL: You MUST respond with ONLY a valid JSON object. Never respond with plain text. Even for greetings or questions, wrap your reply in the JSON structure above with pendingAction type NONE.
                - CRITICAL: params must ALWAYS be a JSON object {}, never a JSON array []. If scheduling multiple candidates, pick the first one and mention you will handle others separately.
                """
                .formatted(context);

        List<CoWorkerChatRequest.ChatMessage> history = request.history() != null
                ? request.history()
                : List.of();
        int start = Math.max(0, history.size() - 10);
        StringBuilder contextHistory = new StringBuilder();
        for (int i = start; i < history.size(); i++) {
            var h = history.get(i);
            contextHistory.append(h.role().toUpperCase())
                    .append(": ")
                    .append(h.content())
                    .append("\n");
        }

        String fullSystemPrompt = systemPrompt
                + (contextHistory.length() > 0
                        ? "\n\nCONVERSATION SO FAR:\n" + contextHistory
                        : "");

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(fullSystemPrompt)
                .addUserMessage(request.message())
                .temperature(0.3)
                .build();

        try {
            var completion = openAI.chat().completions().create(params);
            tokenService.deductToken(loginId);
            String content = completion.choices().getFirst().message().content()
                    .orElse("{\"message\":\"I'm here to help! What would you like me to do?\",\"pendingAction\":{\"type\":\"NONE\",\"description\":\"\",\"params\":{}}}");

            String clean = cleanJson(content);

            // Fix 2: If OpenAI returned plain text instead of JSON, wrap it gracefully
            if (!clean.startsWith("{")) {
                persistMessage(loginId, "assistant", clean);
                return new CoWorkerChatResponse(clean, null);
            }

            var root = objectMapper.readTree(clean);

            String message = root.path("message").asText("How can I help?");
            persistMessage(loginId, "assistant", message);

            var pa = root.path("pendingAction");
            CoWorkerChatResponse.PendingAction pendingAction = null;
            if (pa != null && !pa.isMissingNode() && !"NONE".equals(pa.path("type").asText("NONE"))) {
                var paramsNode = pa.path("params");
                Map<String, Object> actionParams;
                if (paramsNode.isArray()) {
                    // AI returned params as array (e.g. multiple candidates) — wrap it
                    @SuppressWarnings("unchecked")
                    List<Object> list = objectMapper.convertValue(paramsNode, List.class);
                    actionParams = new java.util.LinkedHashMap<>();
                    actionParams.put("items", list);
                    // Also extract candidateIds/candidateNames for convenience
                    List<String> ids = new ArrayList<>();
                    List<String> names = new ArrayList<>();
                    for (Object item : list) {
                        if (item instanceof Map<?,?> m) {
                            if (m.get("candidateId") != null) ids.add(m.get("candidateId").toString());
                            if (m.get("candidateName") != null) names.add(m.get("candidateName").toString());
                        }
                    }
                    if (!ids.isEmpty()) actionParams.put("candidateIds", ids);
                    if (!names.isEmpty()) actionParams.put("candidateNames", names);
                } else {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> m = objectMapper.convertValue(paramsNode, Map.class);
                    actionParams = m != null ? m : new java.util.LinkedHashMap<>();
                }
                pendingAction = new CoWorkerChatResponse.PendingAction(
                        pa.path("type").asText(),
                        pa.path("description").asText(),
                        actionParams);
            }

            return new CoWorkerChatResponse(message, pendingAction);

        } catch (Exception e) {
            // Fix 1: log full error to backend, return generic message to UI
            System.err.println("[CoWorker] chat() failed: " + e.getMessage());
            e.printStackTrace();
            return new CoWorkerChatResponse(
                    "Something went wrong on our end. Please try again.", null);
        }
    }

    // ─── Confirm + execute action ─────────────────────────────────────────────

    public Map<String, Object> confirmAction(String loginId, CoWorkerConfirmRequest req) {
        String type = req.actionType();
        var params = req.params();

        return switch (type) {
            case "RUN_ANALYSIS" -> executeRunAnalysis(loginId, params);
            case "SCHEDULE_INTERVIEW" -> executeScheduleInterview(loginId, params);
            case "RESCHEDULE_AND_NOTIFY" -> executeRescheduleAndNotify(loginId, params);
            case "MOVE_PIPELINE" -> executeMovePipeline(loginId, params);
            case "EMAIL" -> buildEmailNavigation(params);
            case "CREATE_REMINDER" -> executeCreateReminder(loginId, params);
            default -> Map.of("message", "Unknown action type: " + type, "success", false);
        };
    }

    // ─── Get tasks for right panel ────────────────────────────────────────────

    public List<CoWorkerTaskResponse> getTasks(String loginId, String status) {
        String where = status != null && !status.equals("all")
                ? "and status = '" + status + "'"
                : "";
        return jdbc.query("""
                select id, task_type, description, status, progress, created_at, completed_at
                from coworker_tasks
                where login_id = ? %s
                order by created_at desc limit 20
                """.formatted(where),
                (rs, r) -> {
                    OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
                    OffsetDateTime completed = rs.getObject("completed_at", OffsetDateTime.class);
                    return new CoWorkerTaskResponse(
                            rs.getLong("id"),
                            rs.getString("task_type"),
                            rs.getString("description"),
                            rs.getString("status"),
                            rs.getInt("progress"),
                            created != null ? created.toInstant() : null,
                            completed != null ? completed.toInstant() : null);
                }, loginId);
    }

    // ─── Get message history ──────────────────────────────────────────────────

    public List<Map<String, String>> getHistory(String loginId) {
        return jdbc.query("""
                select role, content, created_at from coworker_messages
                where login_id = ?
                order by created_at asc limit 50
                """,
                (rs, r) -> Map.of(
                        "role", rs.getString("role"),
                        "content", rs.getString("content")),
                loginId);
    }

    // ─── Action executors ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeRunAnalysis(String loginId, Map<String, Object> params) {
        List<String> candidateIds = (List<String>) params.getOrDefault("candidateIds", List.of());
        List<String> names = (List<String>) params.getOrDefault("candidateNames", List.of());

        if (candidateIds.isEmpty()) {
            return Map.of("message", "No candidates to analyse.", "success", false);
        }

        Long taskId = createTask(loginId, "RUN_ANALYSIS",
                "Analysis: " + String.join(", ", names));

        // Change 2: replaced raw INSERT with proper AnalysisService.analyze() call
        int succeeded = 0;
        for (String candidateId : candidateIds) {
            try {
                updateTaskProgress(taskId, 10);
                CandidateResponse candidate = analysisService.getJobIdNameForCandidate(candidateId);
                analysisService.analyze(candidateId, candidate, loginId);
                updateTaskProgress(taskId, 80);
                succeeded++;
            } catch (Exception e) {
                System.err.println("[CoWorker] executeRunAnalysis() error for "
                        + candidateId + ": " + e.getMessage());
            }
        }

        markTaskDone(taskId);
        return Map.of(
                "message", succeeded + " of " + candidateIds.size() + " candidate(s) analysed: "
                        + String.join(", ", names) + ". View results from the Candidates page.",
                "success", true,
                "taskId", taskId);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeScheduleInterview(String loginId, Map<String, Object> params) {
        String candidateId   = (String) params.get("candidateId");
        String candidateName = (String) params.getOrDefault("candidateName", "Candidate");
        String type          = (String) params.getOrDefault("interviewType", "Video Interview");
        String scheduledAt   = (String) params.get("scheduledAt");
        String notes         = (String) params.getOrDefault("notes", "");

        if (candidateId == null) {
            return Map.of("message", "Could not find that candidate.", "success", false);
        }

        Long taskId = createTask(loginId, "SCHEDULE_INTERVIEW",
                "Scheduled: " + candidateName + " — " + type);
        try {
            OffsetDateTime dt = scheduledAt != null
                    ? parseFlexibleDateTime(scheduledAt)
                    : OffsetDateTime.now(ZoneOffset.UTC).plusDays(1);

            // Conflict check — give actionable feedback instead of generic error
            Integer conflictCount = jdbc.queryForObject("""
                    select count(*) from interviews
                    where login_id = ?
                      and status = 'Scheduled'
                      and scheduled_at < (?::timestamptz + interval '60 minutes')
                      and (scheduled_at + (coalesce(duration_minutes,60)||' minutes')::interval) > ?::timestamptz
                    """, Integer.class, loginId, dt, dt);
            if (conflictCount != null && conflictCount > 0) {
                markTaskDone(taskId);
                return Map.of(
                        "message", "⚠ Time conflict: another interview is already booked at that time for "
                                + candidateName + ". " + getNextAvailableSlots(loginId),
                        "success", false,
                        "conflict", true);
            }

            // Fix 2a: look up job_id — required NOT NULL column in interviews table
            List<String> jobIds = jdbc.query(
                    "select job_id from candidates where id = ? and is_active = true",
                    (rs, r) -> rs.getString("job_id"), candidateId);
            if (jobIds.isEmpty()) {
                return Map.of("message", "Candidate not found.", "success", false);
            }
            String jobId = jobIds.get(0);

            // Fix 2b: generate UUID — id is TEXT PRIMARY KEY with no default
            String interviewId = "int-" + UUID.randomUUID();

            jdbc.update("""
                    insert into interviews
                        (id, candidate_id, job_id, login_id, interview_type, scheduled_at, status, notes)
                    values (?, ?, ?, ?, ?, ?, 'Scheduled', ?)
                    """, interviewId, candidateId, jobId, loginId, type, dt, notes);

            markTaskDone(taskId);
            return Map.of(
                    "message", type + " scheduled for " + candidateName
                            + (scheduledAt != null ? " on " + scheduledAt : "") + ".",
                    "success", true);
        } catch (Exception e) {
            // Fix 2c: log full error, return generic message to UI
            System.err.println("[CoWorker] executeScheduleInterview() failed: " + e.getMessage());
            e.printStackTrace();
            return Map.of("message", "Could not schedule the interview. Please try again.", "success", false);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeMovePipeline(String loginId, Map<String, Object> params) {
        List<String> candidateIds = (List<String>) params.getOrDefault("candidateIds", List.of());
        List<String> names = (List<String>) params.getOrDefault("candidateNames", List.of());
        String toStage = (String) params.getOrDefault("toStage", "Interview");

        if (candidateIds.isEmpty()) {
            return Map.of("message", "No candidates to move.", "success", false);
        }

        Long taskId = createTask(loginId, "MOVE_PIPELINE",
                "Moved " + candidateIds.size() + " candidate(s) → " + toStage);

        int moved = 0;
        for (String id : candidateIds) {
            try {
                int rows = jdbc.update("""
                        update candidates set stage = ?, updated_at = now()
                        where id = ? and login_id = ? and is_active = true
                        """, toStage, id, loginId);
                if (rows > 0)
                    moved++;
            } catch (Exception ignored) {
            }
        }

        markTaskDone(taskId);
        return Map.of(
                "message", moved + " candidate(s) moved to " + toStage + ": "
                        + String.join(", ", names) + ".",
                "success", true);
    }

    // EMAIL — does NOT send email. Returns navigation params for the frontend.
    private Map<String, Object> buildEmailNavigation(Map<String, Object> params) {
        return Map.of(
                "message", "Taking you to the Email Centre with the draft pre-filled. "
                        + "Review and send when ready.",
                "success", true,
                "navigateTo", "/email",
                "emailParams", params);
    }

    private Map<String, Object> executeCreateReminder(String loginId, Map<String, Object> params) {
        String title       = (String) params.getOrDefault("title", "Reminder");
        String candidateId = (String) params.get("candidateId");
        String dueAtStr    = (String) params.get("dueAt");
        String priority    = (String) params.getOrDefault("priority", "Normal");

        try {
            OffsetDateTime dueAt = dueAtStr != null
                    ? parseFlexibleDateTime(dueAtStr)
                    : OffsetDateTime.now(ZoneOffset.UTC).plusHours(24);

            jdbc.update("""
                    insert into reminders (login_id, candidate_id, title, reminder_type, priority, due_at)
                    values (?, ?, ?, 'MANUAL', ?, ?)
                    """, loginId, candidateId, title, priority, dueAt);

            return Map.of("message", "Reminder set: \"" + title + "\".", "success", true);
        } catch (Exception e) {
            // Fix 3: log full error, return generic message to UI
            System.err.println("[CoWorker] executeCreateReminder() failed: " + e.getMessage());
            e.printStackTrace();
            return Map.of("message", "Could not create the reminder. Please try again.", "success", false);
        }
    }

    // ─── Reschedule + notify + next slots (multi-step) ───────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeRescheduleAndNotify(String loginId, Map<String, Object> params) {
        String interviewId    = (String) params.get("interviewId");
        String candidateId    = (String) params.get("candidateId");
        String candidateName  = (String) params.getOrDefault("candidateName", "Candidate");
        String newScheduledAt = (String) params.get("newScheduledAt");
        String type           = (String) params.getOrDefault("interviewType", "Video Interview");
        String notes          = (String) params.getOrDefault("notes", "");

        try {
            // Step 1: Cancel existing interview
            if (interviewId != null) {
                jdbc.update("update interviews set status = 'Cancelled' where id = ? and login_id = ?",
                        interviewId, loginId);
            }

            // Step 2: Book new slot with conflict check
            String scheduledMsg = "";
            if (newScheduledAt != null) {
                OffsetDateTime newDt = parseFlexibleDateTime(newScheduledAt);

                Integer conflictCount = jdbc.queryForObject("""
                        select count(*) from interviews
                        where login_id = ? and status = 'Scheduled'
                          and scheduled_at < (?::timestamptz + interval '60 minutes')
                          and (scheduled_at + (coalesce(duration_minutes,60)||' minutes')::interval) > ?::timestamptz
                        """, Integer.class, loginId, newDt, newDt);

                if (conflictCount != null && conflictCount > 0) {
                    return Map.of(
                            "message", "⚠ The new time conflicts with another interview. "
                                    + getNextAvailableSlots(loginId),
                            "success", false, "conflict", true);
                }

                List<String> jobIds = jdbc.query(
                        "select job_id from candidates where id = ? and is_active = true",
                        (rs, r) -> rs.getString("job_id"), candidateId);
                if (!jobIds.isEmpty()) {
                    String newId = "int-" + UUID.randomUUID();
                    jdbc.update("""
                            insert into interviews
                                (id, candidate_id, job_id, login_id, interview_type, scheduled_at, status, notes)
                            values (?, ?, ?, ?, ?, ?, 'Scheduled', ?)
                            """, newId, candidateId, jobIds.get(0), loginId, type, newDt, notes);
                    scheduledMsg = " New interview booked for " + newScheduledAt + ".";
                }
            }

            // Step 3: Next available slots
            String slotsMsg = getNextAvailableSlots(loginId);

            // Step 4: Pre-fill email to notify candidate
            Map<String, Object> emailParams = new LinkedHashMap<>();
            emailParams.put("candidateId",   candidateId);
            emailParams.put("candidateName", candidateName);
            emailParams.put("subject",       "Your Interview Has Been Rescheduled");
            emailParams.put("body",          "Dear " + candidateName + ",\n\nYour interview has been rescheduled."
                    + (newScheduledAt != null ? " Your new time is " + newScheduledAt + "." : "")
                    + "\n\nPlease confirm your availability.\n\nBest regards,\nRecruitment Team");

            return Map.of(
                    "message", "Interview for " + candidateName + " cancelled." + scheduledMsg
                            + " Opening Email Centre to notify them. " + slotsMsg,
                    "success",    true,
                    "navigateTo", "/email",
                    "emailParams", emailParams);

        } catch (Exception e) {
            System.err.println("[CoWorker] executeRescheduleAndNotify() failed: " + e.getMessage());
            e.printStackTrace();
            return Map.of("message", "Could not complete the reschedule. Please try again.", "success", false);
        }
    }

    // ─── Context builder ──────────────────────────────────────────────────────

    private String buildInterviewContext(String loginId) {
        try {
            var interviews = jdbc.query("""
                    select i.id, c.name as candidate_name, i.interview_type,
                           i.scheduled_at, i.status
                    from interviews i
                    join candidates c on c.id = i.candidate_id
                    where i.login_id = ?
                      and i.status = 'Scheduled'
                      and i.scheduled_at >= now()
                    order by i.scheduled_at asc limit 20
                    """,
                    (rs, r) -> {
                        OffsetDateTime dt = rs.getObject("scheduled_at", OffsetDateTime.class);
                        return "Interview[id=" + rs.getString("id")
                                + ",candidate=" + rs.getString("candidate_name")
                                + ",type=" + rs.getString("interview_type")
                                + ",at=" + (dt != null ? dt.toString() : "TBD")
                                + ",status=" + rs.getString("status") + "]";
                    }, loginId);
            return interviews.isEmpty() ? "No upcoming interviews." : String.join("\n", interviews);
        } catch (Exception e) {
            return "Interview data unavailable.";
        }
    }

    private String getNextAvailableSlots(String loginId) {
        try {
            var booked = jdbc.query("""
                    select scheduled_at, coalesce(duration_minutes, 60) as dur
                    from interviews
                    where login_id = ? and status = 'Scheduled'
                      and scheduled_at between now() and now() + interval '7 days'
                    """,
                    (rs, r) -> {
                        OffsetDateTime dt = rs.getObject("scheduled_at", OffsetDateTime.class);
                        int dur = rs.getInt("dur");
                        return dt != null
                                ? new long[]{ dt.toEpochSecond(), dt.toEpochSecond() + dur * 60L }
                                : new long[]{ 0, 0 };
                    }, loginId);

            List<String> slots = new ArrayList<>();
            java.time.LocalDate day = java.time.LocalDate.now(ZoneOffset.UTC).plusDays(1);
            int found = 0;
            while (found < 6 && !day.isAfter(java.time.LocalDate.now(ZoneOffset.UTC).plusDays(14))) {
                if (day.getDayOfWeek().getValue() <= 5) {
                    for (int hour : new int[]{ 9, 11, 14, 16 }) {
                        OffsetDateTime slot = day.atTime(hour, 0).atOffset(ZoneOffset.UTC);
                        long s = slot.toEpochSecond(), e = s + 3600;
                        boolean conflict = booked.stream().anyMatch(b -> b[0] < e && b[1] > s);
                        if (!conflict) { slots.add(slot.toString()); if (++found >= 6) break; }
                    }
                }
                day = day.plusDays(1);
            }
            return slots.isEmpty() ? "No free slots found in the next 14 days."
                    : "Next available slots: " + String.join(", ", slots);
        } catch (Exception e) {
            return "Slot availability unavailable.";
        }
    }

    // ─── Context builder ──────────────────────────────────────────────────────

    private String buildContext(String loginId) {
        try {
            var jobs = jdbc.query("""
                    select id, title, company from jobs
                    where login_id = ? and is_active = true
                    order by created_at desc limit 10
                    """,
                    (rs, r) -> "Job[id=" + rs.getString("id")
                            + ",title=" + rs.getString("title")
                            + ",company=" + rs.getString("company") + "]",
                    loginId);

            var candidates = jdbc.query("""
                    select c.id, c.name, c.stage, j.title as job_title,
                           a.consistency_score, a.capability_score,
                           a.risk_level, a.placement_prob_json
                    from candidates c
                    join jobs j on j.id = c.job_id
                    left join (
                        select distinct on (candidate_id)
                               candidate_id, consistency_score, capability_score,
                               risk_level, placement_prob_json
                        from analyses
                        order by candidate_id, created_at desc
                    ) a on a.candidate_id = c.id
                    where c.login_id = ? and c.is_active = true
                    order by c.created_at desc limit 30
                    """,
                    (rs, r) -> {
                        Object consistencyScore = rs.getObject("consistency_score");
                        Object capabilityScore  = rs.getObject("capability_score");
                        String riskLevel        = rs.getString("risk_level");
                        // Extract placementProbability integer from the JSON column
                        Integer placementProb   = extractPlacementProbability(rs.getString("placement_prob_json"));
                        boolean analysed = consistencyScore != null || capabilityScore != null;
                        String entry = "Candidate[id=" + rs.getString("id")
                                + ",name=" + rs.getString("name")
                                + ",stage=" + rs.getString("stage")
                                + ",job=" + rs.getString("job_title")
                                + ",analysed=" + analysed;
                        if (analysed) {
                            entry += ",consistencyScore=" + consistencyScore
                                   + ",capabilityScore=" + capabilityScore
                                   + ",riskLevel=" + riskLevel
                                   + ",placementProbability=" + (placementProb != null ? placementProb + "%" : "N/A");
                        }
                        return entry + "]";
                    },
                    loginId);

            return "JOBS:\n" + String.join("\n", jobs)
                    + "\n\nCANDIDATES:\n" + String.join("\n", candidates)
                    + "\n\nUPCOMING INTERVIEWS:\n" + buildInterviewContext(loginId);
        } catch (Exception e) {
            System.err.println("[CoWorker] buildContext() failed: " + e.getMessage());
            e.printStackTrace();
            return "Context unavailable.";
        }
    }

    // ─── Flexible datetime parser ─────────────────────────────────────────────
    // Handles all formats the AI may return:
    //   "2026-03-29T10:00"     → ISO_LOCAL_DATE_TIME (no zone)
    //   "2026-03-29T10:00Z"    → ISO instant with Z
    //   "2026-03-29T10:00+05:30" → ISO offset datetime

    private static OffsetDateTime parseFlexibleDateTime(String s) {
        try {
            // Try full offset/zoned format first (handles Z, +HH:mm, etc.)
            return OffsetDateTime.parse(s, java.time.format.DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e1) {
            // Fall back to local datetime (no zone) and assume UTC
            return java.time.LocalDateTime.parse(s,
                    java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    .atOffset(ZoneOffset.UTC);
        }
    }

    // ─── Extract placementProbability integer from JSON string ───────────────

    private Integer extractPlacementProbability(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            var node = objectMapper.readTree(json);
            var prob = node.path("placementProbability");
            return prob.isMissingNode() ? null : prob.asInt();
        } catch (Exception e) {
            return null;
        }
    }

    // ─── DB helpers ───────────────────────────────────────────────────────────

    private void persistMessage(String loginId, String role, String content) {
        try {
            jdbc.update("insert into coworker_messages (login_id, role, content) values (?, ?, ?)",
                    loginId, role, content);
        } catch (Exception ignored) {
        }
    }

    private Long createTask(String loginId, String type, String description) {
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    insert into coworker_tasks (login_id, task_type, description, status, progress)
                    values (?, ?, ?, 'running', 0)
                    """, new String[] { "id" });
            ps.setString(1, loginId);
            ps.setString(2, type);
            ps.setString(3, description);
            return ps;
        }, keys);
        return keys.getKey() != null ? keys.getKey().longValue() : null;
    }

    private void updateTaskProgress(Long taskId, int progress) {
        if (taskId == null) return;
        try {
            jdbc.update("update coworker_tasks set progress = ? where id = ?", progress, taskId);
        } catch (Exception ignored) {
        }
    }

    private void markTaskDone(Long taskId) {
        if (taskId == null) return;
        try {
            jdbc.update("""
                    update coworker_tasks set status = 'done', progress = 100, completed_at = now()
                    where id = ?
                    """, taskId);
        } catch (Exception ignored) {
        }
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }
}