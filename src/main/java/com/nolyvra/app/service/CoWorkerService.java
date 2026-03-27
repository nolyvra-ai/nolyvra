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
                    "type": "RUN_ANALYSIS|SCHEDULE_INTERVIEW|MOVE_PIPELINE|EMAIL|CREATE_REMINDER|NONE",
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
                - Keep your message friendly, concise and specific (mention names and counts).
                - No markdown. No extra keys.
                - CRITICAL: You MUST respond with ONLY a valid JSON object. Never respond with plain text. Even for greetings or questions, wrap your reply in the JSON structure above with pendingAction type NONE.
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
                @SuppressWarnings("unchecked")
                Map<String, Object> actionParams = objectMapper.convertValue(
                        pa.path("params"), Map.class);
                pendingAction = new CoWorkerChatResponse.PendingAction(
                        pa.path("type").asText(),
                        pa.path("description").asText(),
                        actionParams != null ? actionParams : Map.of());
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
                    ? java.time.LocalDateTime.parse(scheduledAt,
                            java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                            .atOffset(ZoneOffset.UTC)
                    : OffsetDateTime.now(ZoneOffset.UTC).plusDays(1);

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
                    ? java.time.LocalDateTime.parse(dueAtStr,
                            java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                            .atOffset(ZoneOffset.UTC)
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
                    + "\n\nCANDIDATES:\n" + String.join("\n", candidates);
        } catch (Exception e) {
            System.err.println("[CoWorker] buildContext() failed: " + e.getMessage());
            e.printStackTrace();
            return "Context unavailable.";
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