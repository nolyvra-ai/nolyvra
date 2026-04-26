package com.nolyvra.app.controller;

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

    public LoginController(LoginService loginService, SessionService sessionService) {
        this.loginService = loginService;
        this.sessionService = sessionService;
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

        String sessionToken = sessionService.createSession(resp.id());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", resp.id());
        result.put("name", resp.name());
        result.put("company", resp.company());
        result.put("email", resp.email());
        result.put("sessionToken", sessionToken);
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
}