package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.TimesheetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/crm")
public class TimesheetController {

    private final TimesheetService      timesheetService;
    private final CrmEntitlementService entitlementService;
    private final SessionContext        sessionContext;

    public TimesheetController(TimesheetService timesheetService, CrmEntitlementService entitlementService,
                                SessionContext sessionContext) {
        this.timesheetService = timesheetService;
        this.entitlementService = entitlementService;
        this.sessionContext = sessionContext;
    }

    // Employee sessions may only ever act on their own employeeId.
    private void requireOwnEmployee(String employeeId) {
        if (sessionContext.isEmployee() && !sessionContext.employeeId().equals(employeeId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted for this employee.");
        }
    }

    @GetMapping("/timesheets")
    public List<TimesheetResponse> list(
            @RequestParam String loginId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String employeeId) {
        entitlementService.checkEntitled(loginId);
        String effectiveEmployeeId = sessionContext.isEmployee() ? sessionContext.employeeId() : employeeId;
        return timesheetService.listAll(loginId, status, effectiveEmployeeId);
    }

    @PostMapping("/employees/{employeeId}/timesheets")
    @ResponseStatus(HttpStatus.CREATED)
    public TimesheetResponse submit(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @Valid @RequestBody TimesheetCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        return timesheetService.submitTimesheet(employeeId, req, loginId);
    }

    // Admin only — not reachable by employee sessions (not on the interceptor allowlist).
    @PostMapping("/timesheets/{id}/action")
    public TimesheetResponse action(
            @PathVariable String id,
            @RequestParam String loginId,
            @Valid @RequestBody TimesheetActionRequest req) {
        entitlementService.checkEntitled(loginId);
        return timesheetService.actionRequest(id, req, loginId);
    }

    @DeleteMapping("/timesheets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        timesheetService.cancelRequest(id, loginId, sessionContext.isEmployee() ? sessionContext.employeeId() : null);
    }

    // Admin only — not reachable by employee sessions (not on the interceptor allowlist).
    @GetMapping("/timesheets/analytics")
    public TimesheetAnalyticsResponse analytics(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return timesheetService.getAnalytics(loginId);
    }
}
