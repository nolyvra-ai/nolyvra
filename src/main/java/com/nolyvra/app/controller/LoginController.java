package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.LoginRequest;
import com.nolyvra.app.model.LoginResponse;
import com.nolyvra.app.service.LoginService;
import com.nolyvra.app.service.SessionService;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class LoginController {

    private final LoginService loginService;
    private final SessionService sessionService;
    private final SessionContext sessionContext;

    public LoginController(LoginService loginService, SessionService sessionService, SessionContext sessionContext) {
        this.loginService = loginService;
        this.sessionService = sessionService;
        this.sessionContext = sessionContext;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String emailId = body.getOrDefault("loginId", "");
        String password = body.getOrDefault("password", "");
        LoginRequest req = new LoginRequest(emailId, password);
        LoginResponse resp = loginService.login(req)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password"));

        // A sub-user's session is created against the PARENT's loginId so the
        // rest of the app (which sends loginId from local storage on every
        // request) transparently operates on the owner's tenant data. Their
        // own identity is preserved as actorLoginId for privileged-action checks.
        boolean isSubuser = resp.isSubuser();
        String effectiveLoginId = isSubuser ? resp.parentLoginId() : resp.id();
        String actorLoginId = isSubuser ? resp.id() : null;

        String sessionToken = sessionService.createSession(effectiveLoginId, actorLoginId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", effectiveLoginId);
        result.put("name", resp.name());
        result.put("company", resp.company());
        result.put("email", resp.email());
        result.put("sessionToken", sessionToken);
        result.put("isSubUser", isSubuser);
        return result;
    }

    @PostMapping("/api/auth/change-password")
    public ResponseEntity<?> changePassword(
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {
        String current = body.get("currentPassword");
        String newPw = body.get("newPassword");
        // Verify current password against DB, then update
        boolean ok = loginService.changePassword(loginId, current, newPw);
        if (!ok)
            return ResponseEntity.badRequest().body(Map.of("error", "Current password is incorrect."));
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @GetMapping("/settings")
    public Map<String, Object> getSettings(@RequestParam String loginId) {
        // monthlyTarget is a tenant-wide setting (shared team target) — stays
        // scoped by loginId. phone is personal, so a sub-user must see/edit
        // their OWN number, not the parent's.
        String phoneTarget = sessionContext.isSubUser() ? sessionContext.actorLoginId() : loginId;
        int target = loginService.getMonthlyTarget(loginId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("monthlyTarget", target);
        result.put("phone", loginService.getPhoneNumber(phoneTarget));
        return result;
    }

    @PutMapping("/settings/phone")
    public ResponseEntity<?> savePhone(
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {
        String phoneTarget = sessionContext.isSubUser() ? sessionContext.actorLoginId() : loginId;
        loginService.savePhoneNumber(phoneTarget, body.get("phone"));
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    @PutMapping("/settings/monthly-target")
    public ResponseEntity<?> saveMonthlyTarget(
            @RequestParam String loginId,
            @RequestBody Map<String, Object> body) {
        Object raw = body.get("monthlyTarget");
        if (raw == null)
            return ResponseEntity.badRequest().body(Map.of("error", "monthlyTarget is required"));
        int target = Math.max(0, Math.min(100, ((Number) raw).intValue()));
        loginService.saveMonthlyTarget(loginId, target);
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    @GetMapping("/dashboard/insights")
    public Map<String, Object> getDashboardInsights(@RequestParam String loginId) {
        return loginService.getDashboardInsights(loginId);
    }

    @GetMapping("/dashboard/monthly-stats")
    public Map<String, Object> getDashboardMonthlyStats(@RequestParam String loginId) {
        int fulfilled = loginService.getFulfilledThisMonth(loginId);
        int target    = loginService.getMonthlyTarget(loginId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fulfilledThisMonth", fulfilled);
        result.put("monthlyTarget", target);
        result.put("totalFeesLast30Days", loginService.getTotalFeesLast30Days(loginId));
        result.put("newClientsLast30Days", loginService.getNewClientsLast30Days(loginId));
        result.put("newJobsLast30Days", loginService.getNewJobsLast30Days(loginId));
        return result;
    }
}