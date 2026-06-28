package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class CrmCoWorkerService {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final TokenService tokenService;
    private final String model;

    public CrmCoWorkerService(OpenAIClient openAI, ObjectMapper objectMapper,
                               JdbcTemplate jdbc, TokenService tokenService,
                               @Value("${openai.model:gpt-4o-mini}") String model) {
        this.openAI       = openAI;
        this.objectMapper = objectMapper;
        this.jdbc         = jdbc;
        this.tokenService = tokenService;
        this.model        = model;
    }

    // ─── Chat ─────────────────────────────────────────────────────────────────

    public CoWorkerChatResponse chat(String loginId, CoWorkerChatRequest request) {
        Long sessionId = request.sessionId();
        if (sessionId == null) {
            String title = request.message().length() > 60
                    ? request.message().substring(0, 57) + "…"
                    : request.message();
            sessionId = createSession(loginId, title);
        }
        persistMessage(loginId, sessionId, "user", request.message());

        String context      = buildContext(loginId);
        String systemPrompt = buildSystemPrompt(context);

        List<CoWorkerChatRequest.ChatMessage> history = request.history() != null ? request.history() : List.of();
        int start = Math.max(0, history.size() - 10);
        StringBuilder historyBlock = new StringBuilder();
        for (int i = start; i < history.size(); i++) {
            var h = history.get(i);
            historyBlock.append(h.role().toUpperCase()).append(": ").append(h.content()).append("\n");
        }
        String fullPrompt = systemPrompt
                + (historyBlock.length() > 0 ? "\n\nCONVERSATION SO FAR:\n" + historyBlock : "");

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(fullPrompt)
                .addUserMessage(request.message())
                .temperature(0.3)
                .build();

        try {
            if (!tokenService.deductToken(loginId)) {
                return new CoWorkerChatResponse(sessionId,
                        "You have run out of tokens. Please upgrade your plan to continue.", null);
            }
            var completion = openAI.chat().completions().create(params);
            String content = completion.choices().getFirst().message().content()
                    .orElse("{\"message\":\"How can I help?\",\"pendingAction\":{\"type\":\"NONE\",\"description\":\"\",\"params\":{}}}");

            String clean = cleanJson(content);
            if (!clean.startsWith("{")) {
                persistMessage(loginId, sessionId, "assistant", clean);
                updateSessionLastMessage(sessionId);
                return new CoWorkerChatResponse(sessionId, clean, null);
            }

            var root    = objectMapper.readTree(clean);
            String msg  = root.path("message").asText("How can I help?");
            persistMessage(loginId, sessionId, "assistant", msg);
            updateSessionLastMessage(sessionId);

            var pa = root.path("pendingAction");
            CoWorkerChatResponse.PendingAction pendingAction = null;
            if (pa != null && !pa.isMissingNode() && !"NONE".equals(pa.path("type").asText("NONE"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> actionParams = objectMapper.convertValue(pa.path("params"), Map.class);
                pendingAction = new CoWorkerChatResponse.PendingAction(
                        pa.path("type").asText(),
                        pa.path("description").asText(),
                        actionParams != null ? actionParams : new LinkedHashMap<>());
            }
            return new CoWorkerChatResponse(sessionId, msg, pendingAction);

        } catch (Exception e) {
            System.err.println("[CrmCoWorker] chat() failed: " + e.getMessage());
            return new CoWorkerChatResponse(sessionId, "Something went wrong. Please try again.", null);
        }
    }

    // ─── Confirm ──────────────────────────────────────────────────────────────

    public Map<String, Object> confirmAction(String loginId, CoWorkerConfirmRequest req) {
        return switch (req.actionType()) {
            case "NAVIGATE"              -> executeNavigate(req.params());
            case "INITIATE_PROMOTION"    -> executeInitiatePromotion(loginId, req.params());
            case "INITIATE_SALARY_REVIEW"-> executeInitiateSalaryReview(loginId, req.params());
            case "APPROVE_LEAVE"         -> executeApproveLeave(loginId, req.params());
            default -> Map.of("message", "Unknown action: " + req.actionType(), "success", false);
        };
    }

    // ─── Action executors ─────────────────────────────────────────────────────

    private Map<String, Object> executeNavigate(Map<String, Object> params) {
        String to    = (String) params.getOrDefault("to", "/crm/employees");
        String label = (String) params.getOrDefault("label", "the requested page");
        return Map.of("message", "Taking you to " + label + ".", "success", true, "navigateTo", to);
    }

    private Map<String, Object> executeInitiatePromotion(String loginId, Map<String, Object> params) {
        String employeeId   = (String) params.get("employeeId");
        String employeeName = (String) params.getOrDefault("employeeName", "Employee");
        String proposedRole = (String) params.getOrDefault("proposedRole", "");
        String notes        = (String) params.getOrDefault("notes", "");

        if (employeeId == null || proposedRole.isBlank()) {
            return Map.of("message", "I need both an employee and a proposed role to proceed.", "success", false);
        }
        Integer active = jdbc.queryForObject(
                "SELECT COUNT(*) FROM promotion_request WHERE login_id = ? AND employee_id = ? AND status = 'IN_PROGRESS' AND is_active = true",
                Integer.class, loginId, employeeId);
        if (active != null && active > 0) {
            return Map.of("message", "There is already an active promotion request for " + employeeName + ". Complete that one first.", "success", false);
        }
        List<String> titles = jdbc.query(
                "SELECT job_title FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                (rs, r) -> rs.getString("job_title"), employeeId, loginId);
        String currentRole = titles.isEmpty() ? "" : (titles.get(0) != null ? titles.get(0) : "");

        String id = "prom-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO promotion_request (id, login_id, employee_id, previous_role, proposed_role, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, loginId, employeeId, currentRole, proposedRole.trim(),
                notes.isBlank() ? null : notes.trim());

        return Map.of(
                "message", "Promotion request created for " + employeeName + " → " + proposedRole + ". The workflow checklist is now open in HR Workflows.",
                "success", true, "navigateTo", "/crm/workflows");
    }

    private Map<String, Object> executeInitiateSalaryReview(String loginId, Map<String, Object> params) {
        String employeeId   = (String) params.get("employeeId");
        String employeeName = (String) params.getOrDefault("employeeName", "Employee");
        Object proposedObj  = params.get("proposedSalary");
        String notes        = (String) params.getOrDefault("notes", "");

        if (employeeId == null || proposedObj == null) {
            return Map.of("message", "I need both an employee and a proposed salary amount.", "success", false);
        }
        Integer active = jdbc.queryForObject(
                "SELECT COUNT(*) FROM salary_review WHERE login_id = ? AND employee_id = ? AND status = 'IN_PROGRESS' AND is_active = true",
                Integer.class, loginId, employeeId);
        if (active != null && active > 0) {
            return Map.of("message", "There is already an active salary review for " + employeeName + ".", "success", false);
        }
        List<BigDecimal> salaries = jdbc.query(
                "SELECT salary FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                (rs, r) -> rs.getBigDecimal("salary"), employeeId, loginId);
        BigDecimal currentSalary  = salaries.isEmpty() ? null : salaries.get(0);
        BigDecimal proposedSalary = new BigDecimal(proposedObj.toString());

        String id = "srev-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO salary_review (id, login_id, employee_id, current_salary, proposed_salary, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, loginId, employeeId, currentSalary, proposedSalary,
                notes.isBlank() ? null : notes.trim());

        return Map.of(
                "message", "Salary review created for " + employeeName
                        + " — proposed: $" + proposedSalary.toPlainString()
                        + ". The workflow is now open in HR Workflows.",
                "success", true, "navigateTo", "/crm/workflows");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeApproveLeave(String loginId, Map<String, Object> params) {
        List<String> requestIds    = (List<String>) params.getOrDefault("requestIds", List.of());
        List<String> employeeNames = (List<String>) params.getOrDefault("employeeNames", List.of());

        if (requestIds.isEmpty()) {
            return Map.of("message", "No leave requests specified.", "success", false);
        }
        int approved = 0;
        for (String reqId : requestIds) {
            int rows = jdbc.update(
                    "UPDATE leave_request SET status = 'APPROVED', actioned_at = now(), updated_at = now() " +
                    "WHERE id = ? AND login_id = ? AND status = 'PENDING' AND is_active = true",
                    reqId, loginId);
            if (rows > 0) approved++;
        }
        String names = String.join(", ", employeeNames);
        return Map.of(
                "message", approved + " leave request(s) approved" + (names.isBlank() ? "" : " for: " + names) + ".",
                "success", true, "navigateTo", "/crm/leave");
    }

    // ─── History / sessions ───────────────────────────────────────────────────

    public List<CoWorkerSessionResponse> getHistory(String loginId) {
        return jdbc.query("""
                SELECT s.id, s.title, s.created_at, s.last_message_at,
                       (SELECT content FROM crm_coworker_messages
                        WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) AS preview
                FROM crm_coworker_sessions s
                WHERE s.login_id = ?
                ORDER BY s.last_message_at DESC LIMIT 50
                """,
                (rs, r) -> {
                    OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
                    OffsetDateTime lastMsg = rs.getObject("last_message_at", OffsetDateTime.class);
                    return new CoWorkerSessionResponse(
                            rs.getLong("id"),
                            rs.getString("title"),
                            rs.getString("preview"),
                            created != null ? created.toInstant() : null,
                            lastMsg != null ? lastMsg.toInstant() : null);
                }, loginId);
    }

    public List<Map<String, String>> getSessionMessages(Long sessionId, String loginId) {
        return jdbc.query("""
                SELECT m.role, m.content
                FROM crm_coworker_messages m
                JOIN crm_coworker_sessions s ON s.id = m.session_id
                WHERE m.session_id = ? AND s.login_id = ?
                ORDER BY m.created_at ASC
                """,
                (rs, r) -> Map.of("role", rs.getString("role"), "content", rs.getString("content")),
                sessionId, loginId);
    }

    // ─── Context builder ──────────────────────────────────────────────────────

    private String buildContext(String loginId) {
        try {
            // Employees
            var employees = jdbc.query("""
                    SELECT e.id, e.first_name, e.last_name, e.job_title, e.status,
                           e.salary, COALESCE(d.name, 'No department') AS dept
                    FROM employees e
                    LEFT JOIN departments d ON d.id = e.department_id
                    WHERE e.login_id = ? AND e.is_active = true
                    ORDER BY e.first_name, e.last_name LIMIT 60
                    """,
                    (rs, r) -> "Employee[id=" + rs.getString("id")
                            + ",name=" + rs.getString("first_name") + " " + rs.getString("last_name")
                            + ",title=" + rs.getString("job_title")
                            + ",status=" + rs.getString("status")
                            + ",salary=" + rs.getString("salary")
                            + ",dept=" + rs.getString("dept") + "]",
                    loginId);

            // Pending leave requests
            var leaveRequests = jdbc.query("""
                    SELECT lr.id, e.first_name || ' ' || e.last_name AS emp_name,
                           lt.name AS leave_type, lr.start_date, lr.end_date, lr.days_requested
                    FROM leave_request lr
                    JOIN employees e ON e.id = lr.employee_id
                    JOIN leave_type lt ON lt.id = lr.leave_type_id
                    WHERE lr.login_id = ? AND lr.status = 'PENDING' AND lr.is_active = true
                    ORDER BY lr.start_date LIMIT 20
                    """,
                    (rs, r) -> "PendingLeave[id=" + rs.getString("id")
                            + ",employee=" + rs.getString("emp_name")
                            + ",type=" + rs.getString("leave_type")
                            + ",from=" + rs.getString("start_date")
                            + ",to=" + rs.getString("end_date")
                            + ",days=" + rs.getString("days_requested") + "]",
                    loginId);

            // Active leave (approved, covers today or future)
            var activeLeave = jdbc.query("""
                    SELECT e.first_name || ' ' || e.last_name AS emp_name,
                           lt.name AS leave_type, lr.start_date, lr.end_date
                    FROM leave_request lr
                    JOIN employees e ON e.id = lr.employee_id
                    JOIN leave_type lt ON lt.id = lr.leave_type_id
                    WHERE lr.login_id = ? AND lr.status = 'APPROVED' AND lr.is_active = true
                      AND lr.end_date >= CURRENT_DATE
                    ORDER BY lr.start_date LIMIT 15
                    """,
                    (rs, r) -> rs.getString("emp_name") + " on " + rs.getString("leave_type")
                            + " (" + rs.getString("start_date") + " to " + rs.getString("end_date") + ")",
                    loginId);

            // In-progress promotions
            var promotions = jdbc.query("""
                    SELECT pr.id, e.first_name || ' ' || e.last_name AS emp_name,
                           pr.previous_role, pr.proposed_role
                    FROM promotion_request pr
                    JOIN employees e ON e.id = pr.employee_id
                    WHERE pr.login_id = ? AND pr.status = 'IN_PROGRESS' AND pr.is_active = true
                    LIMIT 10
                    """,
                    (rs, r) -> "Promotion[id=" + rs.getString("id")
                            + ",employee=" + rs.getString("emp_name")
                            + ",from=" + rs.getString("previous_role")
                            + ",to=" + rs.getString("proposed_role") + "]",
                    loginId);

            // In-progress salary reviews
            var salaryReviews = jdbc.query("""
                    SELECT sr.id, e.first_name || ' ' || e.last_name AS emp_name,
                           sr.current_salary, sr.proposed_salary
                    FROM salary_review sr
                    JOIN employees e ON e.id = sr.employee_id
                    WHERE sr.login_id = ? AND sr.status = 'IN_PROGRESS' AND sr.is_active = true
                    LIMIT 10
                    """,
                    (rs, r) -> "SalaryReview[employee=" + rs.getString("emp_name")
                            + ",current=" + rs.getString("current_salary")
                            + ",proposed=" + rs.getString("proposed_salary") + "]",
                    loginId);

            // Counts for expenses, grievances, disciplinary
            int expenseCount     = countActive("expense_submission", loginId);
            int grievanceCount   = countActive("grievance", loginId);
            int disciplinaryCount= countActive("disciplinary_action", loginId);

            return "EMPLOYEES:\n" + join(employees)
                    + "\n\nPENDING LEAVE REQUESTS:\n" + join(leaveRequests)
                    + "\n\nUPCOMING / CURRENT LEAVE:\n" + join(activeLeave)
                    + "\n\nIN-PROGRESS PROMOTIONS:\n" + join(promotions)
                    + "\n\nIN-PROGRESS SALARY REVIEWS:\n" + join(salaryReviews)
                    + "\n\nOPEN EXPENSE CLAIMS: " + expenseCount
                    + "\nOPEN GRIEVANCES: " + grievanceCount
                    + "\nOPEN DISCIPLINARY ACTIONS: " + disciplinaryCount;

        } catch (Exception e) {
            System.err.println("[CrmCoWorker] buildContext() failed: " + e.getMessage());
            return "Context unavailable.";
        }
    }

    private int countActive(String table, String loginId) {
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + table + " WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'",
                    Integer.class, loginId);
            return n != null ? n : 0;
        } catch (Exception e) { return 0; }
    }

    private String join(List<String> list) {
        return list.isEmpty() ? "None." : String.join("\n", list);
    }

    // ─── System prompt ────────────────────────────────────────────────────────

    private static String buildSystemPrompt(String context) {
        return """
                You are nolyvra CRMx Co-worker — an intelligent HR and workforce management assistant.

                You have access to the following HR data:
                %s

                You MUST always reply with EXACTLY ONE valid JSON object in this format:
                {
                  "message": "<friendly, specific reply>",
                  "pendingAction": {
                    "type": "NAVIGATE|INITIATE_PROMOTION|INITIATE_SALARY_REVIEW|APPROVE_LEAVE|NONE",
                    "description": "<1-sentence human-readable description>",
                    "params": { <action-specific params — see schemas below> }
                  }
                }

                Set pendingAction.type to "NONE" and params to {} for questions, summaries, or greetings.

                PARAMETER SCHEMAS:

                NAVIGATE:
                { "to": "/crm/employees|/crm/leave|/crm/onboarding|/crm/expenses|/crm/grievances|/crm/disciplinary|/crm/workflows|/crm/departments", "label": "page name" }

                INITIATE_PROMOTION:
                { "employeeId": "<real employee id from context>", "employeeName": "<full name>", "proposedRole": "<new job title>", "notes": "<optional>" }

                INITIATE_SALARY_REVIEW:
                { "employeeId": "<real employee id from context>", "employeeName": "<full name>", "proposedSalary": <number — annual>, "notes": "<optional>" }

                APPROVE_LEAVE:
                { "requestIds": ["<leave request id>", ...], "employeeNames": ["<name>", ...] }

                Rules:
                - Always use real employee IDs from the context above. Never guess or invent IDs.
                - For questions about leave, headcount, or status — answer directly and use NONE.
                - APPROVE_LEAVE only works for requests with status PENDING in the context.
                - Keep your message concise, warm, and specific (mention names and numbers).
                - CRITICAL: Respond ONLY with valid JSON. Never plain text. Even greetings must be wrapped.
                """.formatted(context);
    }

    // ─── DB helpers ───────────────────────────────────────────────────────────

    private Long createSession(String loginId, String title) {
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            var ps = con.prepareStatement(
                    "INSERT INTO crm_coworker_sessions (login_id, title) VALUES (?, ?)",
                    new String[]{"id"});
            ps.setString(1, loginId);
            ps.setString(2, title);
            return ps;
        }, keys);
        return keys.getKey() != null ? keys.getKey().longValue() : null;
    }

    private void persistMessage(String loginId, Long sessionId, String role, String content) {
        try {
            jdbc.update(
                    "INSERT INTO crm_coworker_messages (login_id, session_id, role, content) VALUES (?, ?, ?, ?)",
                    loginId, sessionId, role, content);
        } catch (Exception ignored) {}
    }

    private void updateSessionLastMessage(Long sessionId) {
        if (sessionId == null) return;
        try {
            jdbc.update("UPDATE crm_coworker_sessions SET last_message_at = now() WHERE id = ?", sessionId);
        } catch (Exception ignored) {}
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }
}
