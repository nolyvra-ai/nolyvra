package com.nolyvra.app.controller;

import com.nolyvra.app.model.SystemEmailTemplateUpdateRequest;
import com.nolyvra.app.service.SystemEmailTemplateService;
import com.nolyvra.app.service.UserService;
import com.nolyvra.app.service.ResendEmailService;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth/admin/system-email-templates")
public class SystemEmailTemplateController {

    private final SystemEmailTemplateService templates;
    private final UserService users;
    private final ResendEmailService resend;

    public SystemEmailTemplateController(
            SystemEmailTemplateService templates,
            UserService users,
            ResendEmailService resend) {
        this.templates = templates;
        this.users = users;
        this.resend = resend;
    }

    @GetMapping("/status")
    public ResponseEntity<?> status(@RequestParam String loginId) {
        if (!users.isAdmin(loginId)) return forbidden();
        return ResponseEntity.ok(Map.of("resendConfigured", resend.isConfigured()));
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam String loginId) {
        if (!users.isAdmin(loginId)) return forbidden();
        return ResponseEntity.ok(templates.list());
    }

    @GetMapping("/{key}")
    public ResponseEntity<?> get(@RequestParam String loginId, @PathVariable String key) {
        if (!users.isAdmin(loginId)) return forbidden();
        return execute(() -> templates.get(key));
    }

    @PutMapping("/{key}")
    public ResponseEntity<?> update(
            @RequestParam String loginId,
            @PathVariable String key,
            @RequestBody SystemEmailTemplateUpdateRequest request) {
        if (!users.isAdmin(loginId)) return forbidden();
        return execute(() -> templates.update(key, request, loginId));
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<?> restore(
            @RequestParam String loginId,
            @RequestParam long version,
            @PathVariable String key) {
        if (!users.isAdmin(loginId)) return forbidden();
        return execute(() -> templates.restore(key, version));
    }

    private ResponseEntity<?> execute(java.util.function.Supplier<Object> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (OptimisticLockingFailureException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
    }
}
