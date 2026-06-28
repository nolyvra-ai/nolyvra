package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OnboardingInstanceService {

    private final JdbcTemplate             jdbc;
    private final OnboardingTemplateService templateService;

    public OnboardingInstanceService(JdbcTemplate jdbc,
                                     OnboardingTemplateService templateService) {
        this.jdbc            = jdbc;
        this.templateService = templateService;
    }

    // ─── Start onboarding ─────────────────────────────────────────────────────

    public OnboardingInstanceResponse startOnboarding(String employeeId, String templateId, String loginId) {
        // idempotency: one non-cancelled instance per employee
        List<String> existing = jdbc.queryForList(
                "SELECT id FROM onboarding_instance WHERE login_id = ? AND employee_id = ? " +
                "AND status NOT IN ('CANCELLED')",
                String.class, loginId, employeeId);
        if (!existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An active onboarding already exists for this employee. Cancel it first.");
        }

        // load employee for start_date and manager
        record EmpRow(LocalDate startDate, String managerId) {}
        List<EmpRow> emps = jdbc.query(
                "SELECT start_date, manager_id FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                (rs, n) -> {
                    Date sd = rs.getDate("start_date");
                    return new EmpRow(sd != null ? sd.toLocalDate() : null, rs.getString("manager_id"));
                }, employeeId, loginId);
        if (emps.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found: " + employeeId);
        }
        EmpRow emp = emps.get(0);

        // load template (validates ownership)
        OnboardingTemplateResponse template = templateService.getTemplate(templateId, loginId);

        // create instance
        String instanceId = "obrd-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO onboarding_instance
                    (id, login_id, employee_id, template_id, status, started_at)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS', now())
                """, instanceId, loginId, employeeId, templateId);

        // snapshot tasks from template groups
        for (OnboardingGroupResponse group : template.groups()) {
            for (OnboardingTaskTemplateResponse task : group.tasks()) {
                LocalDate dueDate = null;
                if (emp.startDate() != null && task.dueOffsetDays() != null) {
                    dueDate = emp.startDate().plusDays(task.dueOffsetDays());
                }
                // HIRING_MANAGER tasks: resolve to the loginId (single-user MVP; FK is forward-compat)
                String assignee = loginId;

                jdbc.update("""
                        INSERT INTO onboarding_task
                            (id, instance_id, group_name, group_sequence, name, sequence,
                             owner_role, assignee_user_id, due_date, is_required)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, "otsk-" + UUID.randomUUID(), instanceId,
                        group.name(), group.sequence(),
                        task.name(), task.sequence(),
                        task.ownerRole(), assignee, dueDate, task.isRequired());
            }
        }

        return getOnboarding(employeeId, loginId);
    }

    // ─── Get onboarding with progress ─────────────────────────────────────────

    public /* @Nullable */ OnboardingInstanceResponse getOnboarding(String employeeId, String loginId) {
        List<Map<String, Object>> instances = jdbc.queryForList(
                "SELECT id, login_id, employee_id, template_id, status, started_at, completed_at " +
                "FROM onboarding_instance WHERE login_id = ? AND employee_id = ? AND status != 'CANCELLED' " +
                "ORDER BY created_at DESC LIMIT 1",
                loginId, employeeId);
        if (instances.isEmpty()) {
            return null;
        }
        Map<String, Object> inst = instances.get(0);
        String instanceId = (String) inst.get("id");

        List<OnboardingTaskResponse> tasks = loadTasks(instanceId);

        // per-group progress
        Map<Integer, List<OnboardingTaskResponse>> byGroup = tasks.stream()
                .collect(Collectors.groupingBy(OnboardingTaskResponse::groupSequence));
        List<OnboardingGroupProgress> groupProgress = byGroup.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    List<OnboardingTaskResponse> gt = e.getValue();
                    String gName = gt.get(0).groupName();
                    long totalRequired = gt.stream().filter(OnboardingTaskResponse::isRequired).count();
                    long completed     = gt.stream()
                            .filter(t -> t.isRequired() && "COMPLETE".equals(t.status())).count();
                    double pct = totalRequired == 0 ? 100.0
                                 : Math.round((double) completed / totalRequired * 1000.0) / 10.0;
                    return new OnboardingGroupProgress(gName, e.getKey(), (int) totalRequired, (int) completed, pct);
                })
                .toList();

        // overall progress
        long totalRequired = tasks.stream().filter(OnboardingTaskResponse::isRequired).count();
        long totalDone     = tasks.stream()
                .filter(t -> t.isRequired() && "COMPLETE".equals(t.status())).count();
        double overallPct  = totalRequired == 0 ? 100.0
                             : Math.round((double) totalDone / totalRequired * 1000.0) / 10.0;
        int overdueCount   = (int) tasks.stream().filter(OnboardingTaskResponse::isOverdue).count();

        java.sql.Timestamp startedAt   = (java.sql.Timestamp) inst.get("started_at");
        java.sql.Timestamp completedAt = (java.sql.Timestamp) inst.get("completed_at");

        return new OnboardingInstanceResponse(
                instanceId,
                (String) inst.get("login_id"),
                (String) inst.get("employee_id"),
                (String) inst.get("template_id"),
                (String) inst.get("status"),
                overallPct, overdueCount, groupProgress, tasks,
                startedAt   != null ? startedAt.toInstant()   : null,
                completedAt != null ? completedAt.toInstant() : null
        );
    }

    // ─── Update a task ────────────────────────────────────────────────────────

    public OnboardingTaskResponse updateTask(String taskId, OnboardingTaskUpdateRequest req, String loginId) {
        // verify task belongs to a tenant-owned instance
        List<String> instanceIds = jdbc.queryForList(
                "SELECT ot.instance_id FROM onboarding_task ot " +
                "JOIN onboarding_instance oi ON oi.id = ot.instance_id " +
                "WHERE ot.id = ? AND oi.login_id = ?",
                String.class, taskId, loginId);
        if (instanceIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found: " + taskId);
        }

        // validate SKIPPED rule
        if ("SKIPPED".equalsIgnoreCase(req.status())) {
            Boolean required = jdbc.queryForObject(
                    "SELECT is_required FROM onboarding_task WHERE id = ?", Boolean.class, taskId);
            if (Boolean.TRUE.equals(required)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Required tasks cannot be skipped");
            }
        }

        String newStatus = req.status() != null ? req.status().toUpperCase() : null;

        jdbc.update("""
                UPDATE onboarding_task
                SET status           = COALESCE(?, status),
                    assignee_user_id = COALESCE(?, assignee_user_id),
                    due_date         = COALESCE(?, due_date),
                    completed_at     = CASE WHEN ? = 'COMPLETE' THEN now() ELSE completed_at END,
                    updated_at       = now()
                WHERE id = ?
                """,
                newStatus, req.assigneeUserId(), req.dueDate(),
                newStatus, taskId);

        return loadTasks(instanceIds.get(0)).stream()
                .filter(t -> t.id().equals(taskId))
                .findFirst()
                .orElseThrow();
    }

    // ─── Activate employee ────────────────────────────────────────────────────

    public OnboardingInstanceResponse activate(String instanceId, String loginId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, employee_id, status FROM onboarding_instance " +
                "WHERE id = ? AND login_id = ?",
                instanceId, loginId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Onboarding instance not found");
        }
        String status     = (String) rows.get(0).get("status");
        String employeeId = (String) rows.get(0).get("employee_id");

        if (!"IN_PROGRESS".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Onboarding is not IN_PROGRESS (current status: " + status + ")");
        }

        // all required tasks must be COMPLETE
        Integer pendingRequired = jdbc.queryForObject(
                "SELECT COUNT(*) FROM onboarding_task " +
                "WHERE instance_id = ? AND is_required = true AND status != 'COMPLETE'",
                Integer.class, instanceId);
        if (pendingRequired != null && pendingRequired > 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    pendingRequired + " required task(s) are not yet complete");
        }

        jdbc.update("""
                UPDATE onboarding_instance
                SET status = 'COMPLETED', completed_at = now(), updated_at = now()
                WHERE id = ? AND login_id = ?
                """, instanceId, loginId);

        jdbc.update("""
                UPDATE employees SET status = 'ACTIVE', updated_at = now()
                WHERE id = ? AND login_id = ?
                """, employeeId, loginId);

        return getOnboarding(employeeId, loginId);
    }

    // ─── Reminders sync ───────────────────────────────────────────────────────
    // Called by a scheduler or on-demand; pushes overdue and upcoming tasks to
    // the existing reminders table. Does not build a new notification channel.

    public void syncReminders(String loginId, int upcomingDays) {
        LocalDate today    = LocalDate.now();
        LocalDate horizon  = today.plusDays(upcomingDays);

        List<Map<String, Object>> tasks = jdbc.queryForList("""
                SELECT ot.id, ot.name, ot.due_date, ot.instance_id,
                       oi.employee_id, e.first_name, e.last_name
                FROM onboarding_task ot
                JOIN onboarding_instance oi ON oi.id = ot.instance_id
                JOIN employees e ON e.id = oi.employee_id
                WHERE oi.login_id = ?
                  AND oi.status = 'IN_PROGRESS'
                  AND ot.status = 'PENDING'
                  AND ot.due_date IS NOT NULL
                  AND ot.due_date <= ?
                  AND NOT EXISTS (
                      SELECT 1 FROM reminders r
                      WHERE r.reminder_type IN ('AUTO_ONBOARDING_OVERDUE','AUTO_ONBOARDING_UPCOMING')
                        AND r.description LIKE '%' || ot.id || '%'
                        AND r.is_completed = false
                  )
                """, loginId, Date.valueOf(horizon));

        for (Map<String, Object> t : tasks) {
            LocalDate dueDate  = ((Date) t.get("due_date")).toLocalDate();
            boolean   overdue  = dueDate.isBefore(today);
            String    empName  = t.get("first_name") + " " + t.get("last_name");
            String    taskName = (String) t.get("name");
            String    taskId   = (String) t.get("id");

            String reminderType = overdue ? "AUTO_ONBOARDING_OVERDUE" : "AUTO_ONBOARDING_UPCOMING";
            String priority     = overdue ? "High" : "Normal";
            String title        = overdue
                    ? "Overdue onboarding task for " + empName + ": " + taskName
                    : "Upcoming onboarding task for " + empName + ": " + taskName;

            OffsetDateTime dueAt = dueDate.atStartOfDay().atOffset(java.time.ZoneOffset.UTC);

            jdbc.update("""
                    INSERT INTO reminders (login_id, title, description, reminder_type, priority, due_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, loginId, title,
                    "Task ID: " + taskId + " | Instance: " + t.get("instance_id"),
                    reminderType, priority, dueAt);
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private List<OnboardingTaskResponse> loadTasks(String instanceId) {
        LocalDate today = LocalDate.now();
        return jdbc.query("""
                SELECT id, instance_id, group_name, group_sequence, name, sequence,
                       owner_role, assignee_user_id, due_date, is_required, status, completed_at
                FROM onboarding_task
                WHERE instance_id = ?
                ORDER BY group_sequence, sequence
                """,
                (rs, n) -> {
                    Date dueSql = rs.getDate("due_date");
                    LocalDate dueDate = dueSql != null ? dueSql.toLocalDate() : null;
                    boolean overdue = dueDate != null && dueDate.isBefore(today)
                            && !"COMPLETE".equals(rs.getString("status"))
                            && !"SKIPPED".equals(rs.getString("status"));
                    OffsetDateTime completedAt = rs.getObject("completed_at", OffsetDateTime.class);
                    return new OnboardingTaskResponse(
                            rs.getString("id"),
                            rs.getString("instance_id"),
                            rs.getString("group_name"),
                            rs.getInt("group_sequence"),
                            rs.getString("name"),
                            rs.getInt("sequence"),
                            rs.getString("owner_role"),
                            rs.getString("assignee_user_id"),
                            dueDate, rs.getBoolean("is_required"),
                            rs.getString("status"),
                            overdue,
                            completedAt != null ? completedAt.toInstant() : null
                    );
                }, instanceId);
    }
}
