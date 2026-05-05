package com.nolyvra.app.controller;

import com.nolyvra.app.model.OAuthToken;
import com.nolyvra.app.service.GoogleOAuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/auth/google")
public class GoogleOAuthController {

    private final GoogleOAuthService googleOAuthService;
    private final String frontendUrl;

    public GoogleOAuthController(
            GoogleOAuthService googleOAuthService,
            @Value("${google.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.googleOAuthService = googleOAuthService;
        this.frontendUrl = frontendUrl;
    }

    @GetMapping("/connect")
    public ResponseEntity<Void> connect(@RequestParam String loginId) {
        String url = googleOAuthService.getAuthorizationUrl(loginId);
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {

        if (error != null || code == null || state == null) {
            return redirect(frontendUrl + "/settings?gmail=error");
        }
        try {
            googleOAuthService.exchangeCodeForToken(code, state);
            return redirect(frontendUrl + "/settings?gmail=connected");
        } catch (Exception e) {
            System.err.println("Google OAuth callback error: " + e.getMessage());
            return redirect(frontendUrl + "/settings?gmail=error");
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestParam String loginId) {
        OAuthToken token = googleOAuthService.getToken(loginId);
        if (token == null) return ResponseEntity.ok(Map.of("connected", false));
        return ResponseEntity.ok(Map.of(
                "connected", true,
                "email", token.email() != null ? token.email() : ""));
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@RequestParam String loginId) {
        googleOAuthService.disconnect(loginId);
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }
}
