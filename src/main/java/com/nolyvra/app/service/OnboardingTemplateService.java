package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class OnboardingTemplateService {

    private final JdbcTemplate jdbc;

    public OnboardingTemplateService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Seed: the 7-group default template ───────────────────────────────────
    // This is content, not structure. Group names, task names, offsets, and
    // owner roles are all just data — tenants can rename, reorder, add, or delete
    // everything after cloning. To change the seed: edit the lists below.

    private record SeedGroup(String name, int seq, List<SeedTask> tasks) {}
    private record SeedTask(String name, int seq, String ownerRole, Integer offsetDays, boolean required) {}

    private static final String SEED_TEMPLATE_NAME = "Standard Onboarding";

    private static final List<SeedGroup> SEED_GROUPS = List.of(

        new SeedGroup("Document Collection", 1, List.of(
            new SeedTask("Send employment contract",            1, "HR",              -7, true),
            new SeedTask("Collect signed offer letter",         2, "HR",              -5, true),
            new SeedTask("Collect government-issued ID",        3, "HR",               0, true),
            new SeedTask("Collect right-to-work documents",     4, "HR",               0, true)
        )),

        new SeedGroup("Background Verification", 2, List.of(
            new SeedTask("Initiate background check",           1, "HR",              -3, true),
            new SeedTask("Confirm background check cleared",    2, "HR",               5, true)
        )),

        new SeedGroup("IT Provisioning", 3, List.of(
            new SeedTask("Create company email account",        1, "IT",              -2, true),
            new SeedTask("Set up laptop / equipment",           2, "IT",              -1, true),
            new SeedTask("Grant system access",                 3, "IT",               0, true),
            new SeedTask("Send login credentials to new hire",  4, "IT",               0, true)
        )),

        new SeedGroup("Orientation", 4, List.of(
            new SeedTask("Schedule day-1 orientation session",  1, "HIRING_MANAGER",   0, true),
            new SeedTask("Complete health & safety induction",  2, "HR",               1, true),
            new SeedTask("Introduce to team",                   3, "HIRING_MANAGER",   0, true),
            new SeedTask("Company values & culture walkthrough",4, "HR",               1, false)
        )),

        new SeedGroup("Role & Team Setup", 5, List.of(
            new SeedTask("Assign first project or tasks",       1, "HIRING_MANAGER",   3, true),
            new SeedTask("Set up 30/60/90-day plan",            2, "HIRING_MANAGER",   5, false),
            new SeedTask("Schedule ongoing 1-to-1 cadence",     3, "HIRING_MANAGER",   3, false)
        )),

        new SeedGroup("Payroll & Benefits", 6, List.of(
            new SeedTask("Add new hire to payroll",             1, "HR",              -5, true),
            new SeedTask("Enrol in benefits scheme",            2, "HR",               0, false),
            new SeedTask("Set up pension contributions",        3, "HR",               3, false)
        )),

        new SeedGroup("Activation Check", 7, List.of(
            new SeedTask("Confirm all required tasks complete", 1, "HR",               7, true)
        ))
    );

    // ─── RowMappers ───────────────────────────────────────────────────────────

    private final RowMapper<OnboardingTaskTemplateResponse> TASK_MAPPER = (rs, n) -> {
        OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);
        return new OnboardingTaskTemplateResponse(
                rs.getString("id"),
                rs.getString("group_id"),
                rs.getString("name"),
                rs.getInt("sequence"),
                rs.getString("owner_role"),
                (Integer) rs.getObject("due_offset_days"),
                rs.getBoolean("is_required"),
                odt != null ? odt.toInstant() : null
        );
    };

    // ─── Public API ───────────────────────────────────────────────────────────

    public List<OnboardingTemplateResponse> listTemplates(String loginId) {
        List<String> ids = jdbc.queryForList(
                "SELECT id FROM onboarding_template WHERE login_id = ? AND is_active = true ORDER BY name",
                String.class, loginId);
        if (ids.isEmpty()) {
            seedDefaultTemplate(loginId);
            ids = jdbc.queryForList(
                    "SELECT id FROM onboarding_template WHERE login_id = ? AND is_active = true ORDER BY name",
                    String.class, loginId);
        }
        List<OnboardingTemplateResponse> result = new ArrayList<>();
        for (String id : ids) {
            result.add(getTemplate(id, loginId));
        }
        return result;
    }

    public OnboardingTemplateResponse getTemplate(String id, String loginId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, login_id, name, employment_type, is_default, is_active, created_at, updated_at " +
                "FROM onboarding_template WHERE id = ? AND login_id = ? AND is_active = true",
                id, loginId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Template not found: " + id);
        }
        Map<String, Object> row = rows.get(0);
        List<OnboardingGroupResponse> groups = loadGroupsWithTasks(id);
        java.sql.Timestamp createdAt = (java.sql.Timestamp) row.get("created_at");
        java.sql.Timestamp updatedAt = (java.sql.Timestamp) row.get("updated_at");
        return new OnboardingTemplateResponse(
                (String) row.get("id"),
                (String) row.get("login_id"),
                (String) row.get("name"),
                (String) row.get("employment_type"),
                (Boolean) row.get("is_default"),
                (Boolean) row.get("is_active"),
                groups,
                createdAt != null ? createdAt.toInstant() : null,
                updatedAt != null ? updatedAt.toInstant() : null
        );
    }

    public OnboardingTemplateResponse createTemplate(OnboardingTemplateCreateRequest req, String loginId) {
        validateEmploymentType(req.employmentType());
        String id = "tmpl-" + UUID.randomUUID();
        if (req.isDefault()) clearOtherDefaults(loginId);
        jdbc.update("""
                INSERT INTO onboarding_template (id, login_id, name, employment_type, is_default)
                VALUES (?, ?, ?, ?, ?)
                """, id, loginId, req.name().trim(), req.employmentType(), req.isDefault());
        return getTemplate(id, loginId);
    }

    public OnboardingTemplateResponse updateTemplate(String id, OnboardingTemplateCreateRequest req, String loginId) {
        requireOwned(id, loginId);
        validateEmploymentType(req.employmentType());
        if (req.isDefault()) clearOtherDefaults(loginId);
        jdbc.update("""
                UPDATE onboarding_template
                SET name = COALESCE(?, name),
                    employment_type = ?,
                    is_default = ?,
                    updated_at = now()
                WHERE id = ? AND login_id = ? AND is_active = true
                """, req.name() != null ? req.name().trim() : null,
                req.employmentType(), req.isDefault(), id, loginId);
        return getTemplate(id, loginId);
    }

    public void deleteTemplate(String id, String loginId) {
        requireOwned(id, loginId);
        jdbc.update("UPDATE onboarding_template SET is_active = false, updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
    }

    public OnboardingTemplateResponse cloneTemplate(String id, String loginId) {
        OnboardingTemplateResponse src = getTemplate(id, loginId);
        String newId = "tmpl-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO onboarding_template (id, login_id, name, employment_type, is_default)
                VALUES (?, ?, ?, ?, false)
                """, newId, loginId, "Copy of " + src.name(), src.employmentType());
        for (OnboardingGroupResponse g : src.groups()) {
            String newGroupId = "tgrp-" + UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO onboarding_template_group (id, template_id, name, sequence)
                    VALUES (?, ?, ?, ?)
                    """, newGroupId, newId, g.name(), g.sequence());
            for (OnboardingTaskTemplateResponse t : g.tasks()) {
                jdbc.update("""
                        INSERT INTO onboarding_template_task
                            (id, group_id, name, sequence, owner_role, due_offset_days, is_required)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, "ttsk-" + UUID.randomUUID(), newGroupId,
                        t.name(), t.sequence(), t.ownerRole(), t.dueOffsetDays(), t.isRequired());
            }
        }
        return getTemplate(newId, loginId);
    }

    // ─── Group operations ─────────────────────────────────────────────────────

    public OnboardingTemplateResponse createGroup(String templateId, OnboardingGroupRequest req, String loginId) {
        requireOwned(templateId, loginId);
        jdbc.update("""
                INSERT INTO onboarding_template_group (id, template_id, name, sequence)
                VALUES (?, ?, ?, ?)
                """, "tgrp-" + UUID.randomUUID(), templateId, req.name().trim(), req.sequence());
        return getTemplate(templateId, loginId);
    }

    public OnboardingTemplateResponse updateGroup(String templateId, String groupId, OnboardingGroupRequest req, String loginId) {
        requireOwned(templateId, loginId);
        requireGroupOwned(groupId, templateId);
        jdbc.update("""
                UPDATE onboarding_template_group
                SET name = COALESCE(?, name), sequence = ?, updated_at = now()
                WHERE id = ? AND template_id = ?
                """, req.name() != null ? req.name().trim() : null, req.sequence(), groupId, templateId);
        return getTemplate(templateId, loginId);
    }

    public OnboardingTemplateResponse deleteGroup(String templateId, String groupId, String loginId) {
        requireOwned(templateId, loginId);
        requireGroupOwned(groupId, templateId);
        jdbc.update("DELETE FROM onboarding_template_group WHERE id = ? AND template_id = ?", groupId, templateId);
        return getTemplate(templateId, loginId);
    }

    public OnboardingTemplateResponse reorderGroups(String templateId, ReorderRequest req, String loginId) {
        requireOwned(templateId, loginId);
        for (ReorderRequest.ReorderItem item : req.items()) {
            jdbc.update("""
                    UPDATE onboarding_template_group SET sequence = ?, updated_at = now()
                    WHERE id = ? AND template_id = ?
                    """, item.sequence(), item.id(), templateId);
        }
        return getTemplate(templateId, loginId);
    }

    // ─── Task operations ──────────────────────────────────────────────────────

    public OnboardingTemplateResponse createTask(String templateId, String groupId,
                                                 OnboardingTaskTemplateRequest req, String loginId) {
        requireOwned(templateId, loginId);
        requireGroupOwned(groupId, templateId);
        validateOwnerRole(req.ownerRole());
        jdbc.update("""
                INSERT INTO onboarding_template_task
                    (id, group_id, name, sequence, owner_role, due_offset_days, is_required)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, "ttsk-" + UUID.randomUUID(), groupId,
                req.name().trim(), req.sequence(), req.ownerRole(), req.dueOffsetDays(), req.isRequired());
        return getTemplate(templateId, loginId);
    }

    public OnboardingTemplateResponse updateTask(String templateId, String groupId, String taskId,
                                                 OnboardingTaskTemplateRequest req, String loginId) {
        requireOwned(templateId, loginId);
        requireGroupOwned(groupId, templateId);
        validateOwnerRole(req.ownerRole());
        jdbc.update("""
                UPDATE onboarding_template_task
                SET name            = COALESCE(?, name),
                    sequence        = ?,
                    owner_role      = ?,
                    due_offset_days = ?,
                    is_required     = ?,
                    updated_at      = now()
                WHERE id = ? AND group_id = ?
                """, req.name() != null ? req.name().trim() : null,
                req.sequence(), req.ownerRole(), req.dueOffsetDays(), req.isRequired(), taskId, groupId);
        return getTemplate(templateId, loginId);
    }

    public OnboardingTemplateResponse deleteTask(String templateId, String groupId, String taskId, String loginId) {
        requireOwned(templateId, loginId);
        requireGroupOwned(groupId, templateId);
        jdbc.update("DELETE FROM onboarding_template_task WHERE id = ? AND group_id = ?", taskId, groupId);
        return getTemplate(templateId, loginId);
    }

    public OnboardingTemplateResponse reorderTasks(String templateId, String groupId,
                                                   ReorderRequest req, String loginId) {
        requireOwned(templateId, loginId);
        requireGroupOwned(groupId, templateId);
        for (ReorderRequest.ReorderItem item : req.items()) {
            jdbc.update("""
                    UPDATE onboarding_template_task SET sequence = ?, updated_at = now()
                    WHERE id = ? AND group_id = ?
                    """, item.sequence(), item.id(), groupId);
        }
        return getTemplate(templateId, loginId);
    }

    // ─── Seed logic ───────────────────────────────────────────────────────────

    public void seedDefaultTemplate(String loginId) {
        String tmplId = "tmpl-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO onboarding_template (id, login_id, name, is_default)
                VALUES (?, ?, ?, true)
                """, tmplId, loginId, SEED_TEMPLATE_NAME);
        for (SeedGroup g : SEED_GROUPS) {
            String groupId = "tgrp-" + UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO onboarding_template_group (id, template_id, name, sequence)
                    VALUES (?, ?, ?, ?)
                    """, groupId, tmplId, g.name(), g.seq());
            for (SeedTask t : g.tasks()) {
                jdbc.update("""
                        INSERT INTO onboarding_template_task
                            (id, group_id, name, sequence, owner_role, due_offset_days, is_required)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, "ttsk-" + UUID.randomUUID(), groupId,
                        t.name(), t.seq(), t.ownerRole(), t.offsetDays(), t.required());
            }
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private List<OnboardingGroupResponse> loadGroupsWithTasks(String templateId) {
        List<Map<String, Object>> groupRows = jdbc.queryForList(
                "SELECT id, template_id, name, sequence FROM onboarding_template_group " +
                "WHERE template_id = ? ORDER BY sequence",
                templateId);
        List<OnboardingGroupResponse> groups = new ArrayList<>();
        for (Map<String, Object> g : groupRows) {
            String groupId = (String) g.get("id");
            List<OnboardingTaskTemplateResponse> tasks = jdbc.query(
                    "SELECT id, group_id, name, sequence, owner_role, due_offset_days, is_required, created_at " +
                    "FROM onboarding_template_task WHERE group_id = ? ORDER BY sequence",
                    TASK_MAPPER, groupId);
            groups.add(new OnboardingGroupResponse(
                    groupId,
                    (String) g.get("template_id"),
                    (String) g.get("name"),
                    (Integer) g.get("sequence"),
                    tasks
            ));
        }
        return groups;
    }

    private void requireOwned(String templateId, String loginId) {
        Integer cnt = jdbc.queryForObject(
                "SELECT COUNT(*) FROM onboarding_template WHERE id = ? AND login_id = ? AND is_active = true",
                Integer.class, templateId, loginId);
        if (cnt == null || cnt == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Template not found: " + templateId);
        }
    }

    private void requireGroupOwned(String groupId, String templateId) {
        Integer cnt = jdbc.queryForObject(
                "SELECT COUNT(*) FROM onboarding_template_group WHERE id = ? AND template_id = ?",
                Integer.class, groupId, templateId);
        if (cnt == null || cnt == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found: " + groupId);
        }
    }

    private void clearOtherDefaults(String loginId) {
        jdbc.update("UPDATE onboarding_template SET is_default = false WHERE login_id = ? AND is_active = true",
                loginId);
    }

    private void validateEmploymentType(String v) {
        if (v != null && !v.isBlank() && !List.of("PERMANENT","CONTRACT","PLACED").contains(v)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid employmentType: " + v);
        }
    }

    private void validateOwnerRole(String v) {
        if (v != null && !v.isBlank() && !List.of("HR","HIRING_MANAGER","IT","OTHER").contains(v)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ownerRole: " + v);
        }
    }
}
