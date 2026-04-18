package com.nolyvra.app.controller;

import com.nolyvra.app.model.OAuthToken;
import com.nolyvra.app.service.MicrosoftOAuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/auth/microsoft")
public class OAuthController {

    private final MicrosoftOAuthService microsoftOAuthService;
    private final String frontendUrl;

    public OAuthController(
            MicrosoftOAuthService microsoftOAuthService,
            @Value("${microsoft.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.microsoftOAuthService = microsoftOAuthService;
        this.frontendUrl           = frontendUrl;
    }

    // ─── GET /auth/microsoft/connect?loginId= ─────────────────────────────────
    // Redirects the browser to the Microsoft OAuth consent page

    @GetMapping("/connect")
    public ResponseEntity<Void> connect(@RequestParam String loginId) {
        String url = microsoftOAuthService.getAuthorizationUrl(loginId);
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }

    // ─── GET /auth/microsoft/callback?code=&state= ────────────────────────────
    // Microsoft redirects here after user grants/denies consent

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {

        if (error != null || code == null || state == null) {
            return redirect(frontendUrl + "/settings?outlook=error");
        }
        try {
            microsoftOAuthService.exchangeCodeForToken(code, state);
            return redirect(frontendUrl + "/settings?outlook=connected");
        } catch (Exception e) {
            System.err.println("Microsoft OAuth callback error: " + e.getMessage());
            return redirect(frontendUrl + "/settings?outlook=error");
        }
    }

    // ─── GET /auth/microsoft/status?loginId= ─────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestParam String loginId) {
        OAuthToken token = microsoftOAuthService.getToken(loginId);
        if (token == null) return ResponseEntity.ok(Map.of("connected", false));
        return ResponseEntity.ok(Map.of(
                "connected", true,
                "email", token.email() != null ? token.email() : ""));
    }

    // ─── DELETE /auth/microsoft/disconnect?loginId= ───────────────────────────

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@RequestParam String loginId) {
        microsoftOAuthService.disconnect(loginId);
        return ResponseEntity.noContent().build();
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }
}
