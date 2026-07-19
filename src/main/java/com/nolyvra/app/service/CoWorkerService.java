package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import com.nolyvra.app.config.CoWorkerAnalysisExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;

@Service
public class CoWorkerService {

    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final CoWorkerAiClient aiClient;
    private final AnalysisService analysisService; // Change 1: added
    private final ExecutorService analysisPool;
    private final JobService jobService;
    private final CandidateService candidateService;
    private final PlanService planService;

    public CoWorkerService(
            ObjectMapper objectMapper,
            JdbcTemplate jdbc,
            CoWorkerAiClient aiClient,
            @Lazy AnalysisService analysisService, // Change 1: added (@Lazy avoids circular dependency)
            CoWorkerAnalysisExecutor analysisExecutor,
            JobService jobService,
            CandidateService candidateService,
            PlanService planService) {
        this.objectMapper = objectMapper;
        this.jdbc = jdbc;
        this.aiClient = aiClient;
        this.analysisService = analysisService; // Change 1: added
        this.analysisPool = analysisExecutor.executorService();
        this.jobService = jobService;
        this.candidateService = candidateService;
        this.planService = planService;
    }

    // ─── Main chat endpoint ───────────────────────────────────────────────────

    public CoWorkerChatResponse chat(String loginId, CoWorkerChatRequest request) {
        String context = buildContext(loginId);

        // Resolve or create session
        Long sessionId = request.sessionId();
        if (sessionId == null) {
            String title = request.message().length() > 60
                    ? request.message().substring(0, 57) + "…"
                    : request.message();
            sessionId = createSession(loginId, title);
        }

        persistMessage(loginId, sessionId, "user", request.message());

        if (isPipelineSummaryRequest(request.message())) {
            CoWorkerChatResponse response = buildPipelineSummary(loginId, sessionId);
            persistMessage(loginId, sessionId, "assistant", response.message());
            updateSessionLastMessage(sessionId);
            return response;
        }

        try {
            CoWorkerChatResponse response = aiClient.chat(
                    loginId,
                    sessionId,
                    request.message(),
                    context,
                    request.history() != null ? request.history() : List.of());
            persistMessage(loginId, sessionId, "assistant", response.message());
            updateSessionLastMessage(sessionId);
            return response;
        } catch (Exception e) {
            System.err.println("[CoWorker] chat() failed: " + e.getMessage());
            e.printStackTrace();
            return new CoWorkerChatResponse(
                    sessionId, "Something went wrong on our end. Please try again.", null);
        }
    }

    private boolean isPipelineSummaryRequest(String message) {
        if (message == null || message.isBlank()) return false;
        String lower = message.toLowerCase(Locale.ROOT);
        return (lower.contains("pipeline") && (lower.contains("movement") || lower.contains("summary") || lower.contains("summarise") || lower.contains("summarize")))
                || (lower.contains("stalled") && lower.contains("candidate"));
    }

    private CoWorkerChatResponse buildPipelineSummary(String loginId, Long sessionId) {
        try {
            Integer stageMoves = jdbc.queryForObject("""
                    select count(*)
                    from activity_timeline
                    where login_id = ?
                      and event_type = 'STAGE_CHANGED'
                      and created_at >= date_trunc('week', now())
                    """, Integer.class, loginId);
            Integer added = jdbc.queryForObject("""
                    select count(*)
                    from activity_timeline
                    where login_id = ?
                      and event_type = 'CANDIDATE_ADDED'
                      and created_at >= date_trunc('week', now())
                    """, Integer.class, loginId);

            List<Map<String, Object>> stageBreakdown = jdbc.query("""
                    select coalesce(nullif(trim(replace(note, 'Stage updated to:', '')), ''), 'Unknown') as stage,
                           count(*) as count
                    from activity_timeline
                    where login_id = ?
                      and event_type = 'STAGE_CHANGED'
                      and created_at >= date_trunc('week', now())
                    group by stage
                    order by count desc, stage asc
                    """, (rs, r) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("stage", rs.getString("stage"));
                row.put("count", rs.getInt("count"));
                return row;
            }, loginId);

            List<Map<String, Object>> recentMoves = jdbc.query("""
                    select c.name, coalesce(j.title, 'Unassigned') as job_title,
                           c.stage, a.note, a.created_at
                    from activity_timeline a
                    join candidates c on c.id = a.candidate_id
                    left join jobs j on j.id = c.job_id
                    where a.login_id = ?
                      and a.event_type = 'STAGE_CHANGED'
                      and a.created_at >= date_trunc('week', now())
                      and c.is_active = true
                    order by a.created_at desc
                    limit 8
                    """, (rs, r) -> {
                OffsetDateTime movedAt = rs.getObject("created_at", OffsetDateTime.class);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("name", rs.getString("name"));
                row.put("jobTitle", rs.getString("job_title"));
                row.put("stage", rs.getString("stage"));
                row.put("note", rs.getString("note"));
                row.put("movedAt", movedAt);
                return row;
            }, loginId);

            List<Map<String, Object>> stalled = jdbc.query("""
                    select c.id, c.name, c.stage, coalesce(j.title, 'Unassigned') as job_title,
                           greatest(c.updated_at, coalesce(max(a.created_at), c.created_at)) as last_activity,
                           extract(day from now() - greatest(c.updated_at, coalesce(max(a.created_at), c.created_at)))::int as days_stalled
                    from candidates c
                    left join jobs j on j.id = c.job_id
                    left join activity_timeline a on a.candidate_id = c.id and a.login_id = c.login_id
                    where c.login_id = ?
                      and c.is_active = true
                      and c.stage not in ('Selected', 'Rejected')
                    group by c.id, c.name, c.stage, j.title, c.updated_at, c.created_at
                    having greatest(c.updated_at, coalesce(max(a.created_at), c.created_at)) < now() - interval '5 days'
                    order by days_stalled desc, c.name asc
                    limit 10
                    """, (rs, r) -> {
                OffsetDateTime lastActivity = rs.getObject("last_activity", OffsetDateTime.class);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", rs.getString("id"));
                row.put("name", rs.getString("name"));
                row.put("stage", rs.getString("stage"));
                row.put("jobTitle", rs.getString("job_title"));
                row.put("lastActivity", lastActivity);
                row.put("daysStalled", rs.getInt("days_stalled"));
                return row;
            }, loginId);

            String message = formatPipelineSummary(
                    stageMoves != null ? stageMoves : 0,
                    added != null ? added : 0,
                    stageBreakdown,
                    recentMoves,
                    stalled);
            return new CoWorkerChatResponse(sessionId, message, null);
        } catch (Exception e) {
            System.err.println("[CoWorker] buildPipelineSummary() failed: " + e.getMessage());
            e.printStackTrace();
            return new CoWorkerChatResponse(
                    sessionId,
                    "I could not summarise pipeline movement right now. Please try again.",
                    null);
        }
    }

    private String formatPipelineSummary(
            int stageMoves,
            int added,
            List<Map<String, Object>> stageBreakdown,
            List<Map<String, Object>> recentMoves,
            List<Map<String, Object>> stalled) {
        StringBuilder sb = new StringBuilder();
        sb.append("This week's pipeline movement: ")
                .append(stageMoves).append(" stage change(s) and ")
                .append(added).append(" new candidate(s) added.");

        if (!stageBreakdown.isEmpty()) {
            sb.append("\n\nStage movement breakdown:");
            for (Map<String, Object> row : stageBreakdown) {
                sb.append("\n- ").append(row.get("stage")).append(": ").append(row.get("count"));
            }
        }

        if (!recentMoves.isEmpty()) {
            sb.append("\n\nRecent movements:");
            for (Map<String, Object> row : recentMoves) {
                sb.append("\n- ")
                        .append(row.get("name"))
                        .append(" → ")
                        .append(row.get("stage"))
                        .append(" (")
                        .append(row.get("jobTitle"))
                        .append(")");
            }
        }

        if (stalled.isEmpty()) {
            sb.append("\n\nNo stalled active candidates found using the 5-day inactivity threshold.");
        } else {
            sb.append("\n\nStalled candidates to review:");
            for (Map<String, Object> row : stalled) {
                sb.append("\n- ")
                        .append(row.get("name"))
                        .append(" has been in ")
                        .append(row.get("stage"))
                        .append(" for ")
                        .append(row.get("daysStalled"))
                        .append(" day(s) without activity (")
                        .append(row.get("jobTitle"))
                        .append(")");
            }
        }

        return sb.toString();
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
            case "CREATE_JOB" -> executeCreateJob(loginId, params);
            case "ADD_CANDIDATES" -> executeAddCandidates(loginId, params);
            default -> Map.of("message", "Unknown action type: " + type, "success", false);
        };
    }

    // ─── Get tasks for right panel ────────────────────────────────────────────

    public List<CoWorkerTaskResponse> getTasks(String loginId, String status) {
        String normalizedStatus = normalizeTaskStatus(status);
        if (normalizedStatus == null) {
            return jdbc.query("""
                    select id, task_type, description, status, progress, created_at, completed_at
                    from coworker_tasks
                    where login_id = ?
                    order by created_at desc limit 20
                    """, this::mapTaskRow, loginId);
        }

        return jdbc.query("""
                select id, task_type, description, status, progress, created_at, completed_at
                from coworker_tasks
                where login_id = ? and status = ?
                order by created_at desc limit 20
                """, this::mapTaskRow, loginId, normalizedStatus);
    }

    private CoWorkerTaskResponse mapTaskRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
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
    }

    private static String normalizeTaskStatus(String status) {
        if (status == null || status.isBlank() || status.equalsIgnoreCase("all")) {
            return null;
        }

        String normalized = status.trim().toLowerCase(Locale.ROOT);
        if (normalized.equals("active")) {
            return "running";
        }
        if (Set.of("pending", "running", "done", "failed").contains(normalized)) {
            return normalized;
        }
        return "__invalid__";
    }

    // ─── Get session list (history sidebar) ──────────────────────────────────

    public List<CoWorkerSessionResponse> getHistory(String loginId) {
        return jdbc.query("""
                select s.id, s.title, s.created_at, s.last_message_at,
                       (select content from coworker_messages
                        where session_id = s.id order by created_at desc limit 1) as preview
                from coworker_sessions s
                where s.login_id = ?
                order by s.last_message_at desc limit 50
                """,
                (rs, r) -> {
                    var created = rs.getObject("created_at",
                            java.time.OffsetDateTime.class);
                    var lastMsg = rs.getObject("last_message_at",
                            java.time.OffsetDateTime.class);
                    return new CoWorkerSessionResponse(
                            rs.getLong("id"),
                            rs.getString("title"),
                            rs.getString("preview"),
                            created != null ? created.toInstant() : null,
                            lastMsg != null ? lastMsg.toInstant() : null);
                }, loginId);
    }

    // ─── Get messages for a specific session ─────────────────────────────────

    public List<Map<String, String>> getSessionMessages(Long sessionId, String loginId) {
        return jdbc.query("""
                select m.role, m.content
                from coworker_messages m
                join coworker_sessions s on s.id = m.session_id
                where m.session_id = ? and s.login_id = ?
                order by m.created_at asc
                """,
                (rs, r) -> Map.of(
                        "role", rs.getString("role"),
                        "content", rs.getString("content")),
                sessionId, loginId);
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

        // Run analysis in background using a fixed 3-thread pool.
        // — Returns immediately so navigation does not interrupt the work.
        // — 3 threads = safe for all OpenAI tiers without hitting RPM limits.
        CompletableFuture.runAsync(() -> {
            // Build one future per candidate, all capped at 3 concurrent threads
            List<CompletableFuture<Void>> futures = candidateIds.stream()
                    .map(candidateId -> CompletableFuture.runAsync(() -> {
                        try {
                            // Skip if analysis already exists in DB
                            Integer existingCount = jdbc.queryForObject(
                                    "select count(*) from analyses where candidate_id = ?",
                                    Integer.class, candidateId);
                            if (existingCount != null && existingCount > 0) {
                                System.out.println("[CoWorker] Skipping " + candidateId + " — already analysed.");
                                return;
                            }
                            updateTaskProgress(taskId, 10);
                            CandidateResponse candidate = analysisService.getJobIdNameForCandidate(candidateId);
                            analysisService.analyze(candidateId, candidate, loginId);
                            updateTaskProgress(taskId, 80);
                        } catch (Exception e) {
                            System.err.println("[CoWorker] executeRunAnalysis() error for "
                                    + candidateId + ": " + e.getMessage());
                        }
                    }, analysisPool))
                    .toList();

            // Wait for all candidates to finish, then mark done
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            markTaskDone(taskId);
            System.out.println("[CoWorker] Bulk analysis complete for: " + String.join(", ", names));
        });

        // Return immediately — frontend polls /tasks to see progress
        String startMsg = "Analysis started for " + candidateIds.size()
                + " candidate(s): " + String.join(", ", names)
                + ". You can navigate freely — the analysis will continue in the background.";
        return Map.of("message", startMsg, "success", true, "taskId", taskId);
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

    private Map<String, Object> executeCreateJob(String loginId, Map<String, Object> params) {
        String title = textParam(params, "title", "");
        String jdText = textParam(params, "jdText", "");

        if (title.isBlank() || jdText.isBlank()) {
            return Map.of(
                    "message", "I need at least a job title and job description before creating the job.",
                    "success", false);
        }

        try {
            if (planService != null && planService.isJobLimitReached(loginId)) {
                return Map.of(
                        "message", "Your job limit has been reached. Please upgrade your plan before creating another job.",
                        "success", false);
            }

            JobCreateRequest request = new JobCreateRequest(
                    title,
                    textParam(params, "company", ""),
                    textParam(params, "jobType", "Full-time"),
                    textParam(params, "seniority", null),
                    jdText,
                    textParam(params, "location", ""),
                    listParam(params, "stackTags"),
                    textParam(params, "jobStatus", "Active"),
                    decimalParam(params, "salary"),
                    textParam(params, "currency", "AUD"),
                    decimalParam(params, "feePercentage"),
                    null,
                    null);

            Long taskId = createTask(loginId, "CREATE_JOB", "Created job: " + title);
            JobResponse job = jobService.createJob(request, loginId);
            markTaskDone(taskId);

            return Map.of(
                    "message", "Job created: " + job.title() + ". Opening the candidate add page so you can start filling it.",
                    "success", true,
                    "jobId", job.id(),
                    "navigateTo", "/jobs/" + job.id() + "/add-candidates-modern");
        } catch (Exception e) {
            System.err.println("[CoWorker] executeCreateJob() failed: " + e.getMessage());
            e.printStackTrace();
            return Map.of("message", "Could not create the job. Please try again.", "success", false);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeAddCandidates(String loginId, Map<String, Object> params) {
        Object rawCandidates = params.get("candidates");
        List<Map<String, Object>> candidates = new ArrayList<>();
        if (rawCandidates instanceof Collection<?> collection) {
            for (Object item : collection) {
                if (item instanceof Map<?, ?> map) {
                    Map<String, Object> normalized = new LinkedHashMap<>();
                    map.forEach((k, v) -> {
                        if (k != null) normalized.put(k.toString(), v);
                    });
                    candidates.add(normalized);
                }
            }
        } else if (params.get("name") != null || params.get("cvText") != null) {
            candidates.add(params);
        }

        if (candidates.isEmpty()) {
            return Map.of("message", "No CV candidates were provided.", "success", false);
        }

        String jobId = textParam(params, "jobId", null);
        if (jobId != null && jobId.equalsIgnoreCase("null")) jobId = null;
        String jobTitle = textParam(params, "jobTitle", null);

        Long taskId = createTask(loginId, "ADD_CANDIDATES",
                "Attached " + candidates.size() + " CV candidate(s)"
                        + (jobTitle != null ? " to " + jobTitle : ""));

        int created = 0;
        int skipped = 0;
        List<String> createdNames = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (Map<String, Object> candidate : candidates) {
            String name = textParam(candidate, "name", "");
            String cvText = textParam(candidate, "cvText", "");

            if (name.isBlank() || cvText.isBlank()) {
                skipped++;
                errors.add((name.isBlank() ? "Unnamed candidate" : name) + ": missing name or CV text");
                continue;
            }

            try {
                if (planService != null && planService.isCandidateLimitReached(loginId)) {
                    skipped++;
                    errors.add(name + ": candidate limit reached");
                    continue;
                }

                CandidateCreateRequest request = CandidateCreateRequest.builder()
                        .name(name)
                        .email(textParam(candidate, "email", null))
                        .phone(textParam(candidate, "phone", null))
                        .linkedinUrl(textParam(candidate, "linkedinUrl", null))
                        .cvText(cvText)
                        .skills(listParam(candidate, "skills"))
                        .currentTitle(textParam(candidate, "currentTitle", null))
                        .location(textParam(candidate, "location", null))
                        .state(textParam(candidate, "state", null))
                        .yearsExperience(decimalParam(candidate, "yearsExperience"))
                        .seniorityLevel(textParam(candidate, "seniorityLevel", null))
                        .expectedSalaryMin(decimalParam(candidate, "expectedSalaryMin"))
                        .expectedSalaryMax(decimalParam(candidate, "expectedSalaryMax"))
                        .salaryCurrency(textParam(candidate, "salaryCurrency", null))
                        .noticePeriodWeeks(integerParam(candidate, "noticePeriodWeeks"))
                        .workRights(textParam(candidate, "workRights", null))
                        .remoteFlexible(booleanParam(candidate, "remoteFlexible"))
                        .build();

                CandidateResponse createdCandidate = jobId != null && !jobId.isBlank()
                        ? candidateService.addCandidate(jobId, request, loginId)
                        : candidateService.addCandidateUnassigned(request, loginId);
                created++;
                createdNames.add(createdCandidate.name());
            } catch (IllegalStateException e) {
                skipped++;
                errors.add(name + ": " + e.getMessage());
            } catch (Exception e) {
                skipped++;
                errors.add(name + ": could not be added");
                System.err.println("[CoWorker] executeAddCandidates() failed for " + name + ": " + e.getMessage());
                e.printStackTrace();
            }
        }

        markTaskDone(taskId);

        String target = jobTitle != null && !jobTitle.isBlank()
                ? " to " + jobTitle
                : (jobId != null && !jobId.isBlank() ? " to " + jobId : " as unassigned");
        String message = created + " candidate(s) added" + target
                + (createdNames.isEmpty() ? "." : ": " + String.join(", ", createdNames) + ".")
                + (skipped > 0 ? " " + skipped + " skipped. " + String.join("; ", errors) : "");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", message);
        result.put("success", created > 0);
        result.put("created", created);
        result.put("skipped", skipped);
        if (taskId != null) result.put("taskId", taskId);
        return result;
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

    private Long createSession(String loginId, String title) {
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            var ps = con.prepareStatement(
                    "insert into coworker_sessions (login_id, title) values (?, ?)",
                    new String[]{"id"});
            ps.setString(1, loginId);
            ps.setString(2, title);
            return ps;
        }, keys);
        return keys.getKey() != null ? keys.getKey().longValue() : null;
    }

    private void updateSessionLastMessage(Long sessionId) {
        if (sessionId == null) return;
        try {
            jdbc.update("update coworker_sessions set last_message_at = now() where id = ?", sessionId);
        } catch (Exception ignored) {
        }
    }

    private void persistMessage(String loginId, Long sessionId, String role, String content) {
        try {
            jdbc.update(
                    "insert into coworker_messages (login_id, session_id, role, content) values (?, ?, ?, ?)",
                    loginId, sessionId, role, content);
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

    private static String textParam(Map<String, Object> params, String key, String fallback) {
        Object value = params.get(key);
        if (value == null) return fallback;
        String text = value.toString().trim();
        return text.isEmpty() ? fallback : text;
    }

    private static BigDecimal decimalParam(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        String text = value.toString().trim();
        if (text.isEmpty() || text.equalsIgnoreCase("null")) return null;
        try {
            return new BigDecimal(text.replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer integerParam(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof Number number) return number.intValue();
        String text = value.toString().trim();
        if (text.isEmpty() || text.equalsIgnoreCase("null")) return null;
        try {
            return Integer.parseInt(text.replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Boolean booleanParam(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof Boolean bool) return bool;
        String text = value.toString().trim();
        if (text.isEmpty() || text.equalsIgnoreCase("null")) return null;
        return Boolean.parseBoolean(text);
    }

    private static List<String> listParam(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value instanceof Collection<?> collection) {
            return collection.stream()
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
        }
        if (value instanceof String text && !text.isBlank()) {
            return Arrays.stream(text.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
        }
        return List.of();
    }
}
