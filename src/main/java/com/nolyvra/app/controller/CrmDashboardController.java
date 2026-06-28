package com.nolyvra.app.controller;

import com.nolyvra.app.model.CrmDashboardSummaryResponse;
import com.nolyvra.app.service.CrmDashboardService;
import com.nolyvra.app.service.CrmEntitlementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/crm/dashboard")
public class CrmDashboardController {

    private final CrmDashboardService service;
    private final CrmEntitlementService entitlement;

    public CrmDashboardController(CrmDashboardService service, CrmEntitlementService entitlement) {
        this.service     = service;
        this.entitlement = entitlement;
    }

    @GetMapping("/summary")
    public CrmDashboardSummaryResponse getSummary(@RequestParam String loginId) {
        entitlement.checkEntitled(loginId);
        return service.getSummary(loginId);
    }
}
