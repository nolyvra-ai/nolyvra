package com.nolyvra.app.controller;

import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.OnboardingInstanceService;
import com.nolyvra.app.service.OnboardingTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm")
public class OnboardingController {

    private final OnboardingTemplateService  templateService;
    private final OnboardingInstanceService  instanceService;
    private final CrmEntitlementService      entitlementService;

    public OnboardingController(OnboardingTemplateService templateService,
                                OnboardingInstanceService instanceService,
                                CrmEntitlementService entitlementService) {
        this.templateService   = templateService;
        this.instanceService   = instanceService;
        this.entitlementService = entitlementService;
    }

    // ─── Templates ────────────────────────────────────────────────────────────

    @GetMapping("/onboarding/templates")
    public List<OnboardingTemplateResponse> listTemplates(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return templateService.listTemplates(loginId);
    }

    @PostMapping("/onboarding/templates")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardingTemplateResponse createTemplate(
            @RequestParam String loginId,
            @Valid @RequestBody OnboardingTemplateCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.createTemplate(req, loginId);
    }

    @GetMapping("/onboarding/templates/{id}")
    public OnboardingTemplateResponse getTemplate(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return templateService.getTemplate(id, loginId);
    }

    @PutMapping("/onboarding/templates/{id}")
    public OnboardingTemplateResponse updateTemplate(
            @PathVariable String id,
            @RequestParam String loginId,
            @Valid @RequestBody OnboardingTemplateCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.updateTemplate(id, req, loginId);
    }

    @DeleteMapping("/onboarding/templates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplate(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        templateService.deleteTemplate(id, loginId);
    }

    @PostMapping("/onboarding/templates/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardingTemplateResponse cloneTemplate(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return templateService.cloneTemplate(id, loginId);
    }

    // ─── Groups ───────────────────────────────────────────────────────────────

    @PostMapping("/onboarding/templates/{templateId}/groups")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardingTemplateResponse createGroup(
            @PathVariable String templateId,
            @RequestParam String loginId,
            @Valid @RequestBody OnboardingGroupRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.createGroup(templateId, req, loginId);
    }

    @PutMapping("/onboarding/templates/{templateId}/groups/{groupId}")
    public OnboardingTemplateResponse updateGroup(
            @PathVariable String templateId, @PathVariable String groupId,
            @RequestParam String loginId,
            @RequestBody OnboardingGroupRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.updateGroup(templateId, groupId, req, loginId);
    }

    @DeleteMapping("/onboarding/templates/{templateId}/groups/{groupId}")
    public OnboardingTemplateResponse deleteGroup(
            @PathVariable String templateId, @PathVariable String groupId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return templateService.deleteGroup(templateId, groupId, loginId);
    }

    @PutMapping("/onboarding/templates/{templateId}/groups/reorder")
    public OnboardingTemplateResponse reorderGroups(
            @PathVariable String templateId,
            @RequestParam String loginId,
            @RequestBody ReorderRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.reorderGroups(templateId, req, loginId);
    }

    // ─── Tasks (template) ─────────────────────────────────────────────────────

    @PostMapping("/onboarding/templates/{templateId}/groups/{groupId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardingTemplateResponse createTask(
            @PathVariable String templateId, @PathVariable String groupId,
            @RequestParam String loginId,
            @Valid @RequestBody OnboardingTaskTemplateRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.createTask(templateId, groupId, req, loginId);
    }

    @PutMapping("/onboarding/templates/{templateId}/groups/{groupId}/tasks/{taskId}")
    public OnboardingTemplateResponse updateTask(
            @PathVariable String templateId, @PathVariable String groupId,
            @PathVariable String taskId, @RequestParam String loginId,
            @RequestBody OnboardingTaskTemplateRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.updateTask(templateId, groupId, taskId, req, loginId);
    }

    @DeleteMapping("/onboarding/templates/{templateId}/groups/{groupId}/tasks/{taskId}")
    public OnboardingTemplateResponse deleteTask(
            @PathVariable String templateId, @PathVariable String groupId,
            @PathVariable String taskId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return templateService.deleteTask(templateId, groupId, taskId, loginId);
    }

    @PutMapping("/onboarding/templates/{templateId}/groups/{groupId}/tasks/reorder")
    public OnboardingTemplateResponse reorderTasks(
            @PathVariable String templateId, @PathVariable String groupId,
            @RequestParam String loginId,
            @RequestBody ReorderRequest req) {
        entitlementService.checkEntitled(loginId);
        return templateService.reorderTasks(templateId, groupId, req, loginId);
    }

    // ─── Instance ─────────────────────────────────────────────────────────────

    @PostMapping("/employees/{employeeId}/onboarding")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardingInstanceResponse startOnboarding(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {
        entitlementService.checkEntitled(loginId);
        String templateId = body.get("templateId");
        if (templateId == null || templateId.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "templateId is required");
        }
        return instanceService.startOnboarding(employeeId, templateId, loginId);
    }

    @GetMapping("/employees/{employeeId}/onboarding")
    public ResponseEntity<OnboardingInstanceResponse> getOnboarding(
            @PathVariable String employeeId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        OnboardingInstanceResponse result = instanceService.getOnboarding(employeeId, loginId);
        return result != null
                ? ResponseEntity.ok(result)
                : ResponseEntity.notFound().build();
    }

    @PutMapping("/onboarding/tasks/{taskId}")
    public OnboardingTaskResponse updateInstanceTask(
            @PathVariable String taskId,
            @RequestParam String loginId,
            @RequestBody OnboardingTaskUpdateRequest req) {
        entitlementService.checkEntitled(loginId);
        return instanceService.updateTask(taskId, req, loginId);
    }

    @PostMapping("/onboarding/{instanceId}/activate")
    public OnboardingInstanceResponse activate(
            @PathVariable String instanceId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return instanceService.activate(instanceId, loginId);
    }
}
