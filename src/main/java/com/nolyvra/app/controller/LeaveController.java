package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.LeaveService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/crm")
public class LeaveController {

    private final LeaveService           leaveService;
    private final CrmEntitlementService  entitlementService;
    private final SessionContext         sessionContext;

    public LeaveController(LeaveService leaveService, CrmEntitlementService entitlementService,
                            SessionContext sessionContext) {
        this.leaveService       = leaveService;
        this.entitlementService = entitlementService;
        this.sessionContext     = sessionContext;
    }

    // Employee sessions may only ever act on their own employeeId.
    private void requireOwnEmployee(String employeeId) {
        if (sessionContext.isEmployee() && !sessionContext.employeeId().equals(employeeId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted for this employee.");
        }
    }

    // ─── Leave types ──────────────────────────────────────────────────────────

    @GetMapping("/leave/types")
    public List<LeaveTypeResponse> listTypes(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return leaveService.listTypes(loginId);
    }

    @PostMapping("/leave/types")
    @ResponseStatus(HttpStatus.CREATED)
    public LeaveTypeResponse createType(
            @RequestParam String loginId,
            @Valid @RequestBody LeaveTypeRequest req) {
        entitlementService.checkEntitled(loginId);
        return leaveService.createType(req, loginId);
    }

    @PutMapping("/leave/types/{id}")
    public LeaveTypeResponse updateType(
            @PathVariable String id,
            @RequestParam String loginId,
            @Valid @RequestBody LeaveTypeRequest req) {
        entitlementService.checkEntitled(loginId);
        return leaveService.updateType(id, req, loginId);
    }

    @DeleteMapping("/leave/types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteType(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        leaveService.deleteType(id, loginId);
    }

    // ─── Employee leave balance ───────────────────────────────────────────────

    @GetMapping("/employees/{employeeId}/leave-balance")
    public List<LeaveBalanceResponse> getBalance(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @RequestParam(required = false) Integer year) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        int y = (year != null && year > 0) ? year : LocalDate.now().getYear();
        return leaveService.getEmployeeBalance(employeeId, y, loginId);
    }

    @PutMapping("/employees/{employeeId}/leave-balance/{leaveTypeId}")
    public LeaveBalanceResponse setBalance(
            @PathVariable String employeeId,
            @PathVariable String leaveTypeId,
            @RequestParam String loginId,
            @Valid @RequestBody SetLeaveBalanceRequest req) {
        entitlementService.checkEntitled(loginId);
        return leaveService.setEmployeeBalance(employeeId, leaveTypeId, req, loginId);
    }

    // ─── Leave requests ───────────────────────────────────────────────────────

    @GetMapping("/leave/requests")
    public List<LeaveRequestResponse> listRequests(
            @RequestParam String loginId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String employeeId) {
        entitlementService.checkEntitled(loginId);
        String effectiveEmployeeId = sessionContext.isEmployee() ? sessionContext.employeeId() : employeeId;
        return leaveService.listRequests(loginId, status, effectiveEmployeeId);
    }

    @PostMapping("/employees/{employeeId}/leave/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public LeaveRequestResponse submitRequest(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @Valid @RequestBody LeaveRequestCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        return leaveService.submitRequest(employeeId, req, loginId);
    }

    @PostMapping("/leave/requests/{requestId}/action")
    public LeaveRequestResponse actionRequest(
            @PathVariable String requestId,
            @RequestParam String loginId,
            @Valid @RequestBody LeaveActionRequest req) {
        entitlementService.checkEntitled(loginId);
        return leaveService.actionRequest(requestId, req, loginId);
    }

    @DeleteMapping("/leave/requests/{requestId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelRequest(
            @PathVariable String requestId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        leaveService.cancelRequest(requestId, loginId, sessionContext.isEmployee() ? sessionContext.employeeId() : null);
    }
}
