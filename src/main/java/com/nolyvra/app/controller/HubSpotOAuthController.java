package com.nolyvra.app.controller;

import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.service.HubSpotOAuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/auth/hubspot")
public class HubSpotOAuthController {

    private final HubSpotOAuthService hubSpotOAuthService;
    private final String frontendUrl;

    public HubSpotOAuthController(
            HubSpotOAuthService hubSpotOAuthService,
            @Value("${hubspot.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.hubSpotOAuthService = hubSpotOAuthService;
        this.frontendUrl = frontendUrl;
    }

    @GetMapping("/connect")
    public ResponseEntity<Void> connect(@RequestParam String loginId) {
        String url = hubSpotOAuthService.getAuthorizationUrl(loginId);
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {

        if (error != null || code == null || state == null) {
            return redirect(frontendUrl + "/settings?hubspot=error");
        }
        try {
            hubSpotOAuthService.exchangeCodeForToken(code, state);
            return redirect(frontendUrl + "/settings?hubspot=connected");
        } catch (Exception e) {
            System.err.println("HubSpot OAuth callback error: " + e.getMessage());
            return redirect(frontendUrl + "/settings?hubspot=error");
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestParam String loginId) {
        HubSpotConnection connection = hubSpotOAuthService.getConnection(loginId);
        if (connection == null) {
            return ResponseEntity.ok(Map.of("connected", false, "reconnectRequired", false));
        }
        try {
            hubSpotOAuthService.getValidAccessToken(loginId);
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "portalId", connection.hubspotPortalId() != null ? connection.hubspotPortalId() : "",
                    "portalName", connection.hubspotPortalName() != null ? connection.hubspotPortalName() : "",
                    "userEmail", connection.hubspotUserEmail() != null ? connection.hubspotUserEmail() : "",
                    "reconnectRequired", false));
        } catch (HubSpotOAuthService.HubSpotReconnectRequiredException e) {
            return ResponseEntity.ok(Map.of(
                    "connected", false,
                    "portalId", connection.hubspotPortalId() != null ? connection.hubspotPortalId() : "",
                    "portalName", connection.hubspotPortalName() != null ? connection.hubspotPortalName() : "",
                    "userEmail", connection.hubspotUserEmail() != null ? connection.hubspotUserEmail() : "",
                    "reconnectRequired", true));
        } catch (Exception e) {
            System.err.println("HubSpot status check error: " + e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "portalId", connection.hubspotPortalId() != null ? connection.hubspotPortalId() : "",
                    "portalName", connection.hubspotPortalName() != null ? connection.hubspotPortalName() : "",
                    "userEmail", connection.hubspotUserEmail() != null ? connection.hubspotUserEmail() : "",
                    "reconnectRequired", false));
        }
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@RequestParam String loginId) {
        hubSpotOAuthService.disconnect(loginId);
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }
}
