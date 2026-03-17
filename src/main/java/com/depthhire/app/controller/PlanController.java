package com.depthhire.app.controller;

import com.depthhire.app.model.PlanUsageResponse;
import com.depthhire.app.service.PlanService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/plans")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    // GET /api/plans/me?loginId=x
    // Returns current plan + live usage counts — called by frontend before creating job/candidate
    @GetMapping("/me")
    public PlanUsageResponse getMyPlan(@RequestParam String loginId) {
        return planService.getPlanUsage(loginId);
    }
}
