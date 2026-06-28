package com.nolyvra.app.controller;

import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.PromotionService;
import com.nolyvra.app.service.SalaryReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/crm")
public class HrWorkflowController {

    private final PromotionService      promotionService;
    private final SalaryReviewService   salaryReviewService;
    private final CrmEntitlementService entitlementService;

    public HrWorkflowController(PromotionService promotionService,
                                 SalaryReviewService salaryReviewService,
                                 CrmEntitlementService entitlementService) {
        this.promotionService    = promotionService;
        this.salaryReviewService = salaryReviewService;
        this.entitlementService  = entitlementService;
    }

    // ─── Promotions ───────────────────────────────────────────────────────────

    @GetMapping("/promotions")
    public List<PromotionRequestResponse> listAllPromotions(
            @RequestParam String loginId,
            @RequestParam(required = false) String status) {
        entitlementService.checkEntitled(loginId);
        return promotionService.listAll(loginId, status);
    }

    @GetMapping("/employees/{employeeId}/promotions")
    public List<PromotionRequestResponse> listEmployeePromotions(
            @PathVariable String employeeId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return promotionService.listByEmployee(employeeId, loginId);
    }

    @PostMapping("/employees/{employeeId}/promotions")
    @ResponseStatus(HttpStatus.CREATED)
    public PromotionRequestResponse createPromotion(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @Valid @RequestBody PromotionRequestCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        return promotionService.create(employeeId, req, loginId);
    }

    @PutMapping("/promotions/{id}/step")
    public PromotionRequestResponse updatePromotionStep(
            @PathVariable String id,
            @RequestParam String loginId,
            @Valid @RequestBody WorkflowStepRequest req) {
        entitlementService.checkEntitled(loginId);
        return promotionService.updateStep(id, req, loginId);
    }

    @PostMapping("/promotions/{id}/approve")
    public PromotionRequestResponse approvePromotion(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return promotionService.approve(id, loginId);
    }

    @PostMapping("/promotions/{id}/reject")
    public PromotionRequestResponse rejectPromotion(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return promotionService.reject(id, loginId);
    }

    @DeleteMapping("/promotions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelPromotion(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        promotionService.cancel(id, loginId);
    }

    // ─── Salary Reviews ───────────────────────────────────────────────────────

    @GetMapping("/salary-reviews")
    public List<SalaryReviewResponse> listAllSalaryReviews(
            @RequestParam String loginId,
            @RequestParam(required = false) String status) {
        entitlementService.checkEntitled(loginId);
        return salaryReviewService.listAll(loginId, status);
    }

    @GetMapping("/employees/{employeeId}/salary-reviews")
    public List<SalaryReviewResponse> listEmployeeSalaryReviews(
            @PathVariable String employeeId, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return salaryReviewService.listByEmployee(employeeId, loginId);
    }

    @PostMapping("/employees/{employeeId}/salary-reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public SalaryReviewResponse createSalaryReview(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @Valid @RequestBody SalaryReviewCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        return salaryReviewService.create(employeeId, req, loginId);
    }

    @PutMapping("/salary-reviews/{id}/step")
    public SalaryReviewResponse updateSalaryStep(
            @PathVariable String id,
            @RequestParam String loginId,
            @Valid @RequestBody WorkflowStepRequest req) {
        entitlementService.checkEntitled(loginId);
        return salaryReviewService.updateStep(id, req, loginId);
    }

    @PostMapping("/salary-reviews/{id}/approve")
    public SalaryReviewResponse approveSalaryReview(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return salaryReviewService.approve(id, loginId);
    }

    @PostMapping("/salary-reviews/{id}/reject")
    public SalaryReviewResponse rejectSalaryReview(
            @PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return salaryReviewService.reject(id, loginId);
    }

    @DeleteMapping("/salary-reviews/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelSalaryReview(@PathVariable String id, @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        salaryReviewService.cancel(id, loginId);
    }
}
