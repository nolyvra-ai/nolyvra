package com.nolyvra.app.controller;

import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CrmCoWorkerService;
import com.nolyvra.app.service.CrmEntitlementService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm/coworker")
public class CrmCoWorkerController {

    private final CrmCoWorkerService    service;
    private final CrmEntitlementService entitlementService;

    public CrmCoWorkerController(CrmCoWorkerService service, CrmEntitlementService entitlementService) {
        this.service            = service;
        this.entitlementService = entitlementService;
    }

    @PostMapping("/chat")
    @ResponseStatus(HttpStatus.OK)
    public CoWorkerChatResponse chat(
            @RequestParam String loginId,
            @RequestBody CoWorkerChatRequest request) {
        entitlementService.checkEntitled(loginId);
        return service.chat(loginId, request);
    }

    @PostMapping("/confirm")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> confirm(
            @RequestParam String loginId,
            @RequestBody CoWorkerConfirmRequest request) {
        entitlementService.checkEntitled(loginId);
        return service.confirmAction(loginId, request);
    }

    @GetMapping("/history")
    public List<CoWorkerSessionResponse> history(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return service.getHistory(loginId);
    }

    @GetMapping("/sessions/{sessionId}")
    public List<Map<String, String>> sessionMessages(
            @PathVariable Long sessionId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return service.getSessionMessages(sessionId, loginId);
    }
}
