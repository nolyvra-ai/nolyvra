package com.nolyvra.app.controller;

import com.nolyvra.app.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    // POST /api/auth/change-password?loginId=x
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

        boolean updated = userService.changePassword(loginId, currentPassword, newPassword);
        if (!updated) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Current password is incorrect."));
        }
        return ResponseEntity.ok(Map.of("status", "updated"));
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
        return ResponseEntity.ok(Map.of("status", "registered"));
    }

    // POST /api/auth/login
    // Returns loginId, name, planId — also checks 30-day expiry for free plan
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

        userService.onboardUser(targetId);
        return ResponseEntity.ok(Map.of("status", "onboarded"));
    }
}