package com.nolyvra.app.controller;

import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.EmployeeService;
import com.nolyvra.app.service.HubSpotEmployeeSyncService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm")
public class EmployeeController {

    private final EmployeeService       employeeService;
    private final CrmEntitlementService entitlementService;
    private final HubSpotEmployeeSyncService hubSpotEmployeeSyncService;

    public EmployeeController(EmployeeService employeeService,
                              CrmEntitlementService entitlementService,
                              HubSpotEmployeeSyncService hubSpotEmployeeSyncService) {
        this.employeeService    = employeeService;
        this.entitlementService = entitlementService;
        this.hubSpotEmployeeSyncService = hubSpotEmployeeSyncService;
    }

    // ─── Employee CRUD ────────────────────────────────────────────────────────

    @PostMapping("/employees")
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeeResponse create(
            @RequestParam String loginId,
            @Valid @RequestBody EmployeeCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        return employeeService.createEmployee(req, loginId);
    }

    @GetMapping("/employees")
    public List<EmployeeResponse> list(
            @RequestParam String loginId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String managerId) {
        entitlementService.checkEntitled(loginId);
        return employeeService.list(loginId, status, departmentId, managerId);
    }

    // Tenant-only self-service: resolves (creating if needed) the employee
    // record that represents the Nolyvra account holder, so they can submit
    // and approve their own timesheet through the normal employee-scoped flow.
    @GetMapping("/employees/me")
    public EmployeeResponse getOwnEmployee(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return employeeService.getOrCreateOwnerEmployee(loginId);
    }

    @GetMapping("/employees/{id}")
    public EmployeeResponse getById(
            @PathVariable String id,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return employeeService.getById(id, loginId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Employee not found: " + id));
    }

    @PutMapping("/employees/{id}")
    public EmployeeResponse update(
            @PathVariable String id,
            @RequestParam String loginId,
            @RequestBody EmployeeUpdateRequest req) {
        entitlementService.checkEntitled(loginId);
        return employeeService.update(id, req, loginId);
    }

    @PutMapping("/employees/{id}/manager")
    public EmployeeResponse assignManager(
            @PathVariable String id,
            @RequestParam String loginId,
            @Valid @RequestBody AssignManagerRequest req) {
        entitlementService.checkEntitled(loginId);
        return employeeService.assignManager(id, req.managerId(), loginId);
    }

    @PostMapping("/employees/{id}/hubspot/push")
    public HubSpotSyncStatusResponse pushEmployeeToHubSpot(
            @PathVariable String id,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return hubSpotEmployeeSyncService.pushEmployee(id, loginId);
    }

    @PostMapping("/employees/{id}/hubspot/sync")
    public HubSpotSyncStatusResponse syncEmployeeWithHubSpot(
            @PathVariable String id,
            @RequestParam String loginId,
            @RequestParam(required = false, defaultValue = "auto") String direction) {
        entitlementService.checkEntitled(loginId);
        return hubSpotEmployeeSyncService.syncEmployee(id, loginId, direction);
    }

    @GetMapping("/employees/{id}/hubspot/status")
    public HubSpotSyncStatusResponse getEmployeeHubSpotStatus(
            @PathVariable String id,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return hubSpotEmployeeSyncService.getStatus(id, loginId);
    }

    // ─── Bulk Excel upload ────────────────────────────────────────────────────

    @PostMapping("/employees/upload")
    public BulkUploadResult bulkUpload(
            @RequestParam String loginId,
            @RequestParam MultipartFile file) {
        entitlementService.checkEntitled(loginId);
        return employeeService.bulkUpload(file, loginId);
    }

    // ─── Onboard queue ────────────────────────────────────────────────────────

    @GetMapping("/candidates/onboard")
    public List<Map<String, Object>> getSelectedCandidates(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return employeeService.getSelectedCandidates(loginId);
    }

    // ─── Convert ATS candidate to employee ───────────────────────────────────

    @PostMapping("/candidates/{candidateId}/convert")
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeeResponse convertCandidate(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @Valid @RequestBody ConvertCandidateRequest req) {
        entitlementService.checkEntitled(loginId);
        return employeeService.convertCandidate(candidateId, req, loginId);
    }
}
