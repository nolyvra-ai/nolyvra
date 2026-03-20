package com.depthhire.app.controller;

import com.depthhire.app.service.StripeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/stripe")
public class StripeController {

    private final StripeService stripeService;

    public StripeController(StripeService stripeService) {
        this.stripeService = stripeService;
    }

    // ─── POST /api/stripe/checkout ────────────────────────────────────────────
    // Called from PricingPage when user clicks a plan button.
    // Returns the Stripe-hosted checkout URL.

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(
            @RequestParam String loginId,
            @RequestParam String planId,
            @RequestParam(defaultValue = "yearly") String billing,
            @RequestParam String successUrl,
            @RequestParam String cancelUrl) {

        if (loginId == null || loginId.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "loginId is required."));
        }

        try {
            String url = stripeService.createCheckoutSession(
                    loginId, planId, billing, successUrl, cancelUrl);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            System.err.println("[Stripe] Checkout session creation failed: " + e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to create checkout session."));
        }
    }

    // ─── POST /api/stripe/webhook ─────────────────────────────────────────────
    // Stripe calls this automatically after payment events.
    // Run: stripe listen --forward-to localhost:8080/api/stripe/webhook

    @PostMapping("/webhook")
    public ResponseEntity<String> webhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {

        try {
            stripeService.handleWebhook(payload, sigHeader);
            return ResponseEntity.ok("ok");
        } catch (Exception e) {
            System.err.println("[Stripe] Webhook error: " + e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ─── POST /api/stripe/portal ──────────────────────────────────────────────
    // Opens the Stripe Customer Portal for managing / cancelling subscriptions.

    @PostMapping("/portal")
    public ResponseEntity<?> portal(
            @RequestParam String loginId,
            @RequestParam String returnUrl) {

        if (loginId == null || loginId.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "loginId is required."));
        }

        try {
            String url = stripeService.createPortalSession(loginId, returnUrl);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            System.err.println("[Stripe] Portal session creation failed: " + e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to open billing portal."));
        }
    }
}