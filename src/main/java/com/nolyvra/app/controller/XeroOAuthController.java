package com.nolyvra.app.controller;

import com.nolyvra.app.model.XeroConnection;
import com.nolyvra.app.service.XeroOAuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/auth/xero")
public class XeroOAuthController {

    private final XeroOAuthService xeroOAuthService;
    private final String frontendUrl;

    public XeroOAuthController(
            XeroOAuthService xeroOAuthService,
            @Value("${xero.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.xeroOAuthService = xeroOAuthService;
        this.frontendUrl = frontendUrl;
    }

    // ─── GET /auth/xero/connect?loginId= ──────────────────────────────────────
    // Redirects the browser to the Xero OAuth consent page

    @GetMapping("/connect")
    public ResponseEntity<Void> connect(@RequestParam String loginId) {
        String url = xeroOAuthService.getAuthorizationUrl(loginId);
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }

    // ─── GET /auth/xero/callback?code=&state= ─────────────────────────────────
    // Xero redirects here after the user grants/denies consent

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {

        if (error != null || code == null || state == null) {
            return redirect(frontendUrl + "/settings?xero=error");
        }
        try {
            xeroOAuthService.exchangeCodeForToken(code, state);
            return redirect(frontendUrl + "/settings?xero=connected");
        } catch (Exception e) {
            System.err.println("Xero OAuth callback error: " + e.getMessage());
            return redirect(frontendUrl + "/settings?xero=error");
        }
    }

    // ─── GET /auth/xero/status?loginId= ───────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestParam String loginId) {
        XeroConnection connection = xeroOAuthService.getConnection(loginId);
        if (connection == null) {
            return ResponseEntity.ok(Map.of("connected", false, "reconnectRequired", false));
        }
        try {
            // Lazily refresh if near expiry so status reflects whether the
            // connection is actually still usable, not just whether a row exists.
            xeroOAuthService.getValidAccessToken(loginId, connection.xeroTenantId());
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "tenantName", connection.xeroTenantName() != null ? connection.xeroTenantName() : "",
                    "reconnectRequired", false));
        } catch (XeroOAuthService.XeroReconnectRequiredException e) {
            return ResponseEntity.ok(Map.of(
                    "connected", false,
                    "tenantName", connection.xeroTenantName() != null ? connection.xeroTenantName() : "",
                    "reconnectRequired", true));
        } catch (Exception e) {
            System.err.println("Xero status check error: " + e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "tenantName", connection.xeroTenantName() != null ? connection.xeroTenantName() : "",
                    "reconnectRequired", false));
        }
    }

    // ─── DELETE /auth/xero/disconnect?loginId= ────────────────────────────────

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@RequestParam String loginId) {
        xeroOAuthService.disconnect(loginId);
        return ResponseEntity.noContent().build();
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }
}
