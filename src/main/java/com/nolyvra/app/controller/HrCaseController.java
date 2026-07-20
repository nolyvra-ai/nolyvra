package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.DisciplinaryService;
import com.nolyvra.app.service.ExpenseService;
import com.nolyvra.app.service.GrievanceService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm")
public class HrCaseController {

    private final ExpenseService        expenseService;
    private final GrievanceService      grievanceService;
    private final DisciplinaryService   disciplinaryService;
    private final CrmEntitlementService entitlementService;
    private final SessionContext        sessionContext;

    public HrCaseController(ExpenseService expenseService,
                             GrievanceService grievanceService,
                             DisciplinaryService disciplinaryService,
                             CrmEntitlementService entitlementService,
                             SessionContext sessionContext) {
        this.expenseService      = expenseService;
        this.grievanceService    = grievanceService;
        this.disciplinaryService = disciplinaryService;
        this.entitlementService  = entitlementService;
        this.sessionContext      = sessionContext;
    }

    // Employee sessions may only ever act on their own employeeId.
    private void requireOwnEmployee(String employeeId) {
        if (sessionContext.isEmployee() && !sessionContext.employeeId().equals(employeeId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted for this employee.");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Expense Submissions
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping("/expenses/monthly-summary")
    public MonthlyExpenseSummaryResponse getMonthlyExpenseSummary(
            @RequestParam String loginId,
            @RequestParam(required = false) String month) {
        entitlementService.checkEntitled(loginId);
        if (month == null || month.isBlank()) {
            month = java.time.YearMonth.now().toString();
        }
        return expenseService.getMonthlySummary(loginId, month);
    }

    @GetMapping("/expenses")
    public List<ExpenseSubmissionResponse> listAllExpenses(
            @RequestParam String loginId,
            @RequestParam(required = false) String status) {
        entitlementService.checkEntitled(loginId);
        return expenseService.listAll(loginId, status);
    }

    @GetMapping("/employees/{employeeId}/expenses")
    public List<ExpenseSubmissionResponse> listEmployeeExpenses(
            @PathVariable String employeeId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        return expenseService.listByEmployee(employeeId, loginId);
    }

    @PostMapping(value = "/employees/{employeeId}/expenses", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseSubmissionResponse createExpense(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @RequestParam String title,
            @RequestParam(required = false) String amount,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String expenseDate,
            @RequestParam(required = false) String notes,
            @RequestParam(required = false) MultipartFile receipt) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        java.math.BigDecimal amt = amount != null && !amount.isBlank()
                ? new java.math.BigDecimal(amount) : null;
        java.time.LocalDate dt = expenseDate != null && !expenseDate.isBlank()
                ? java.time.LocalDate.parse(expenseDate) : null;
        return expenseService.create(employeeId,
                new ExpenseSubmissionCreateRequest(title, amt, category, dt, notes),
                receipt, loginId);
    }

    @PutMapping("/expenses/{id}/step")
    public ExpenseSubmissionResponse updateExpenseStep(
            @PathVariable String id, @RequestParam String loginId,
            @RequestBody WorkflowStepRequest req) {
        entitlementService.checkEntitled(loginId);
        return expenseService.updateStep(id, req, loginId);
    }

    @PostMapping("/expenses/{id}/approve")
    public ExpenseSubmissionResponse approveExpense(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return expenseService.approve(id, loginId);
    }

    @PostMapping("/expenses/{id}/reject")
    public ExpenseSubmissionResponse rejectExpense(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return expenseService.reject(id, loginId);
    }

    @DeleteMapping("/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelExpense(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        expenseService.cancel(id, loginId, sessionContext.isEmployee() ? sessionContext.employeeId() : null);
    }

    @GetMapping("/expenses/{id}/receipt")
    public ResponseEntity<byte[]> downloadReceipt(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        Map<String, Object> raw = expenseService.getReceiptRaw(id, loginId);
        byte[] data = (byte[]) raw.get("receipt_data");
        String name = (String) raw.get("receipt_name");
        if (data == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Grievances
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping("/grievances")
    public List<GrievanceResponse> listAllGrievances(
            @RequestParam String loginId,
            @RequestParam(required = false) String status) {
        entitlementService.checkEntitled(loginId);
        return grievanceService.listAll(loginId, status);
    }

    @GetMapping("/employees/{employeeId}/grievances")
    public List<GrievanceResponse> listEmployeeGrievances(
            @PathVariable String employeeId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        return grievanceService.listByEmployee(employeeId, loginId);
    }

    @PostMapping(value = "/employees/{employeeId}/grievances", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public GrievanceResponse createGrievance(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) MultipartFile complaint) {
        entitlementService.checkEntitled(loginId);
        requireOwnEmployee(employeeId);
        return grievanceService.create(employeeId,
                new GrievanceCreateRequest(title, description),
                complaint, loginId);
    }

    @PutMapping("/grievances/{id}/step")
    public GrievanceResponse updateGrievanceStep(
            @PathVariable String id, @RequestParam String loginId,
            @RequestBody WorkflowStepRequest req) {
        entitlementService.checkEntitled(loginId);
        return grievanceService.updateStep(id, req, loginId);
    }

    @PostMapping("/grievances/{id}/resolve")
    public GrievanceResponse resolveGrievance(
            @PathVariable String id, @RequestParam String loginId,
            @RequestParam(required = false) String resolutionNotes) {
        entitlementService.checkEntitled(loginId);
        return grievanceService.resolve(id, resolutionNotes, loginId);
    }

    @PostMapping("/grievances/{id}/reject")
    public GrievanceResponse rejectGrievance(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return grievanceService.reject(id, loginId);
    }

    @DeleteMapping("/grievances/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelGrievance(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        grievanceService.cancel(id, loginId, sessionContext.isEmployee() ? sessionContext.employeeId() : null);
    }

    @GetMapping("/grievances/{id}/complaint")
    public ResponseEntity<byte[]> downloadComplaint(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        Map<String, Object> raw = grievanceService.getComplaintRaw(id, loginId);
        byte[] data = (byte[]) raw.get("complaint_data");
        String name = (String) raw.get("complaint_name");
        if (data == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Disciplinary Actions
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping("/disciplinary-actions")
    public List<DisciplinaryActionResponse> listAllDisciplinary(
            @RequestParam String loginId,
            @RequestParam(required = false) String status) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.listAll(loginId, status);
    }

    @GetMapping("/employees/{employeeId}/disciplinary-actions")
    public List<DisciplinaryActionResponse> listEmployeeDisciplinary(
            @PathVariable String employeeId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.listByEmployee(employeeId, loginId);
    }

    @PostMapping(value = "/employees/{employeeId}/disciplinary-actions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DisciplinaryActionResponse createDisciplinary(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @RequestParam String title,
            @RequestParam(required = false) String incidentDescription,
            @RequestParam(required = false) String notes,
            @RequestParam(required = false) MultipartFile incidentReport) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.create(employeeId,
                new DisciplinaryActionCreateRequest(title, incidentDescription, notes),
                incidentReport, loginId);
    }

    @PutMapping("/disciplinary-actions/{id}/step")
    public DisciplinaryActionResponse updateDisciplinaryStep(
            @PathVariable String id, @RequestParam String loginId,
            @RequestBody WorkflowStepRequest req) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.updateStep(id, req, loginId);
    }

    @PostMapping(value = "/disciplinary-actions/{id}/hr-decision", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DisciplinaryActionResponse uploadHrDecision(
            @PathVariable String id, @RequestParam String loginId,
            @RequestParam MultipartFile hrDecision) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.uploadHrDecision(id, hrDecision, loginId);
    }

    @PostMapping("/disciplinary-actions/{id}/corrective-actions")
    @ResponseStatus(HttpStatus.CREATED)
    public DisciplinaryActionResponse addCorrectiveAction(
            @PathVariable String id, @RequestParam String loginId,
            @RequestBody CorrectiveActionItemRequest req) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.addCorrectiveAction(id, req, loginId);
    }

    @PutMapping("/disciplinary-actions/{id}/corrective-actions/{itemId}/toggle")
    public DisciplinaryActionResponse toggleCorrectiveAction(
            @PathVariable String id, @PathVariable String itemId,
            @RequestParam String loginId, @RequestParam boolean done) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.toggleCorrectiveAction(id, itemId, done, loginId);
    }

    @DeleteMapping("/disciplinary-actions/{id}/corrective-actions/{itemId}")
    public DisciplinaryActionResponse deleteCorrectiveAction(
            @PathVariable String id, @PathVariable String itemId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.deleteCorrectiveAction(id, itemId, loginId);
    }

    @PostMapping("/disciplinary-actions/{id}/close")
    public DisciplinaryActionResponse closeDisciplinary(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return disciplinaryService.close(id, loginId);
    }

    @DeleteMapping("/disciplinary-actions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelDisciplinary(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        disciplinaryService.cancel(id, loginId);
    }

    @GetMapping("/disciplinary-actions/{id}/incident-report")
    public ResponseEntity<byte[]> downloadIncidentReport(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        Map<String, Object> raw = disciplinaryService.getIncidentReportRaw(id, loginId);
        byte[] data = (byte[]) raw.get("incident_report_data");
        String name = (String) raw.get("incident_report_name");
        if (data == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @GetMapping("/disciplinary-actions/{id}/hr-decision")
    public ResponseEntity<byte[]> downloadHrDecision(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        Map<String, Object> raw = disciplinaryService.getHrDecisionRaw(id, loginId);
        byte[] data = (byte[]) raw.get("hr_decision_data");
        String name = (String) raw.get("hr_decision_name");
        if (data == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }
}
