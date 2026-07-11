package com.nolyvra.app.controller;

import com.nolyvra.app.model.StackAuditLeadResponse;
import com.nolyvra.app.model.StackAuditRequest;
import com.nolyvra.app.service.StackAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class StackAuditController {

    private final StackAuditService service;

    public StackAuditController(StackAuditService service) {
        this.service = service;
    }

    // Public — no session token required (excluded in WebMvcConfig)
    @PostMapping("/public/stack-audit")
    public ResponseEntity<StackAuditLeadResponse> submit(
            @Valid @RequestBody StackAuditRequest req,
            HttpServletRequest httpReq
    ) {
        String ip = resolveClientIp(httpReq);
        service.checkRateLimit(ip);
        StackAuditLeadResponse report = service.submit(req);
        return ResponseEntity.ok(report);
    }

    // Public — flags a submission as demo requested (excluded in WebMvcConfig via /api/public/**)
    @PatchMapping("/public/stack-audit/{id}/demo")
    public ResponseEntity<Void> requestDemo(@PathVariable long id) {
        service.markDemoRequested(id);
        return ResponseEntity.ok().build();
    }

    // Authenticated — session token required (covered by SessionInterceptor)
    @GetMapping("/stack-audit/leads")
    public List<StackAuditLeadResponse> getLeads() {
        return service.getLeads();
    }

    private String resolveClientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
