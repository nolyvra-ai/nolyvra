package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.service.SessionService;
import com.nolyvra.app.service.AdminSettingsService;
import com.nolyvra.app.service.CandidateMergeMigrationService;
import com.nolyvra.app.service.EmployeeService;
import com.nolyvra.app.service.RegisterInterestNotificationService;
import com.nolyvra.app.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final EmployeeService employeeService;
    private final SessionService sessionService;
    private final SessionContext sessionContext;
    private final AdminSettingsService adminSettingsService;
    private final RegisterInterestNotificationService registerInterestNotificationService;
    private final CandidateMergeMigrationService candidateMergeMigrationService;

    public AuthController(
            UserService userService,
            EmployeeService employeeService,
            SessionService sessionService,
            SessionContext sessionContext,
            AdminSettingsService adminSettingsService,
            RegisterInterestNotificationService registerInterestNotificationService,
            CandidateMergeMigrationService candidateMergeMigrationService) {
        this.userService = userService;
        this.employeeService = employeeService;
        this.sessionService = sessionService;
        this.sessionContext = sessionContext;
        this.adminSettingsService = adminSettingsService;
        this.registerInterestNotificationService = registerInterestNotificationService;
        this.candidateMergeMigrationService = candidateMergeMigrationService;
    }

    // POST /api/auth/change-password?loginId=x
    // For an employee session, updates the employee's own password instead of
    // the tenant's — loginId is ignored in that case (identity comes from the
    // session, not the request).
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {

        String currentPassword = body.get("currentPassword");
        String newPassword     = body.get("newPassword");

        if (currentPassword == null || currentPassword.isBlank() ||
            newPassword     == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "currentPassword and newPassword are required."));
        }
        if (newPassword.length() < 6) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "New password must be at least 6 characters."));
        }

        boolean updated = sessionContext.isEmployee()
                ? employeeService.changePassword(sessionContext.employeeId(), currentPassword, newPassword)
                : userService.changePassword(loginId, currentPassword, newPassword);
        if (!updated) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Current password is incorrect."));
        }
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    // POST /api/auth/employee-login
    // Employee self-service login — separate from tenant /api/auth/login.
    @PostMapping("/employee-login")
    public ResponseEntity<?> employeeLogin(@RequestBody Map<String, String> body) {
        String email    = body.getOrDefault("email",    "").trim();
        String password = body.getOrDefault("password", "").trim();

        if (email.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "email and password are required."));
        }

        return employeeService.login(email, password)
                .<ResponseEntity<?>>map(result -> {
                    String employeeId = (String) result.get("employeeId");
                    String tenantLoginId = (String) result.get("loginId");
                    String sessionToken = sessionService.createEmployeeSession(employeeId, tenantLoginId);
                    result.put("sessionToken", sessionToken);
                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.status(401)
                        .body(Map.of("error", "Invalid credentials.")));
    }

    // POST /api/auth/register
    // Landing page registration — saves user with plan_id = 'registered'
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String firstName = body.getOrDefault("firstName", "").trim();
        String lastName  = body.getOrDefault("lastName",  "").trim();
        String company   = body.getOrDefault("company",   "").trim();
        String email     = body.getOrDefault("email",     "").trim();
        String phone     = body.getOrDefault("phone",     "");

        if (firstName.isBlank() || email.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "First name and email are required."));
        }

        boolean ok = userService.registerInterest(firstName, lastName, company, email, phone);
        if (!ok) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An account with this email already exists."));
        }
        registerInterestNotificationService.notifyNewRegistration(firstName, lastName, company, email, phone);
        return ResponseEntity.ok(Map.of("status", "registered"));
    }

    // POST /api/auth/logout
    // Invalidates the session token supplied in the Authorization header.
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (sessionContext.isEmployee()) {
                sessionService.invalidateEmployeeSession(token);
            } else {
                sessionService.invalidateSession(token);
            }
        }
        return ResponseEntity.ok(Map.of("status", "logged out"));
    }

    // POST /api/auth/login
    // Returns loginId, name, planId, sessionToken — also checks 30-day expiry for free plan
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String loginId  = body.getOrDefault("loginId",  "").trim();
        String password = body.getOrDefault("password", "").trim();

        if (loginId.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "loginId and password are required."));
        }

        return userService.login(loginId, password)
                .<ResponseEntity<?>>map(result -> ResponseEntity.ok(result))
                .orElse(ResponseEntity.status(401)
                        .body(Map.of("error", "Invalid credentials.")));
    }

    // GET /api/auth/admin/users?loginId=x
    // Admin only — returns all users with their plan info
    @GetMapping("/admin/users")
    public ResponseEntity<?> getAdminUsers(@RequestParam String loginId) {
        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }
        List<Map<String, Object>> users = userService.getAllUsersForAdmin();
        return ResponseEntity.ok(users);
    }

    // POST /api/auth/admin/update-limits?loginId=x  ← CHANGE: new endpoint
    // Admin only — sets additional tokens/jobs/candidates for a user
    @PostMapping("/admin/update-limits")
    public ResponseEntity<?> updateLimits(
            @RequestParam String loginId,
            @RequestBody Map<String, Object> body) {

        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        String targetId = (String) body.get("targetLoginId");
        if (targetId == null || targetId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "targetLoginId is required."));
        }

        int additionalTokens     = body.getOrDefault("additionalTokens",     0) instanceof Number n ? n.intValue() : 0;
        int additionalJobs       = body.getOrDefault("additionalJobs",       0) instanceof Number n ? n.intValue() : 0;
        int additionalCandidates = body.getOrDefault("additionalCandidates", 0) instanceof Number n ? n.intValue() : 0;

        userService.updateAdditionalLimits(targetId, additionalTokens, additionalJobs, additionalCandidates);
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    // POST /api/auth/admin/onboard?loginId=x
    // Admin only — sets a registered user's password to default hash
    @PostMapping("/admin/onboard")
    public ResponseEntity<?> onboardUser(
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {

        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        String targetId = body.get("targetLoginId");
        if (targetId == null || targetId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "targetLoginId is required."));
        }

        Map<String, Object> result = userService.onboardUser(targetId, loginId);
        return ResponseEntity.ok(result);
    }

    // POST /api/auth/admin/migrate-applications?loginId=x&targetLoginId=y
    // Admin only — one-off Candidate <-> Job Application data migration for a
    // single tenant (see CandidateMergeMigrationService). Idempotent: safe to
    // call again, it skips tenants that already have job_applications rows.
    @PostMapping("/admin/migrate-applications")
    public ResponseEntity<?> migrateApplications(
            @RequestParam String loginId,
            @RequestParam String targetLoginId) {

        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        return ResponseEntity.ok(candidateMergeMigrationService.migrateTenant(targetLoginId));
    }

    // GET /api/auth/admin/register-interest-notifications?loginId=x
    // Admin only — returns the email recipients notified when someone registers interest
    @GetMapping("/admin/register-interest-notifications")
    public ResponseEntity<?> getRegisterInterestNotifications(@RequestParam String loginId) {
        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("emails", adminSettingsService.getRegisterInterestNotificationEmails());
        response.putAll(adminSettingsService.getRegisterInterestEmailTemplates());
        return ResponseEntity.ok(response);
    }

    // PUT /api/auth/admin/register-interest-notifications?loginId=x
    // Admin only — saves the notification recipient list
    @PutMapping("/admin/register-interest-notifications")
    public ResponseEntity<?> saveRegisterInterestNotifications(
            @RequestParam String loginId,
            @RequestBody Map<String, Object> body) {

        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        Object rawEmails = body.get("emails");
        String emailText = "";
        if (rawEmails instanceof List<?> list) {
            emailText = String.join(",", list.stream().map(String::valueOf).toList());
        } else if (rawEmails != null) {
            emailText = String.valueOf(rawEmails);
        }

        try {
            List<String> emails = adminSettingsService.saveRegisterInterestNotificationEmails(emailText);
            Map<String, String> templates = adminSettingsService.saveRegisterInterestEmailTemplates(
                    stringValue(body.get("confirmationSubject")),
                    stringValue(body.get("confirmationHtml")),
                    stringValue(body.get("notificationSubject")),
                    stringValue(body.get("notificationHtml")));

            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("status", "saved");
            response.put("emails", emails);
            response.putAll(templates);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/auth/admin/onboarding-notifications?loginId=x
    // Admin only — returns the email recipients notified after successful onboarding
    @GetMapping("/admin/onboarding-notifications")
    public ResponseEntity<?> getOnboardingNotifications(@RequestParam String loginId) {
        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("emails", adminSettingsService.getOnboardingNotificationEmails());
        response.putAll(adminSettingsService.getOnboardingEmailTemplates());
        return ResponseEntity.ok(response);
    }

    // PUT /api/auth/admin/onboarding-notifications?loginId=x
    // Admin only — saves onboarding email recipients and templates
    @PutMapping("/admin/onboarding-notifications")
    public ResponseEntity<?> saveOnboardingNotifications(
            @RequestParam String loginId,
            @RequestBody Map<String, Object> body) {

        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        Object rawEmails = body.get("emails");
        String emailText = "";
        if (rawEmails instanceof List<?> list) {
            emailText = String.join(",", list.stream().map(String::valueOf).toList());
        } else if (rawEmails != null) {
            emailText = String.valueOf(rawEmails);
        }

        try {
            List<String> emails = adminSettingsService.saveOnboardingNotificationEmails(emailText);
            Map<String, String> templates = adminSettingsService.saveOnboardingEmailTemplates(
                    stringValue(body.get("confirmationSubject")),
                    stringValue(body.get("confirmationHtml")),
                    stringValue(body.get("notificationSubject")),
                    stringValue(body.get("notificationHtml")));

            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("status", "saved");
            response.put("emails", emails);
            response.putAll(templates);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
