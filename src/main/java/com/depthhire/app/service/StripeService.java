package com.depthhire.app.service;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.ApiResource;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class StripeService {

    private final JdbcTemplate jdbc;

    @Value("${stripe.secret-key}")
    private String secretKey;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    // ── Price IDs from application.yml ────────────────────────────────────────
    @Value("${stripe.price-ids.plan-bronze-monthly}") private String bronzeMonthly;
    @Value("${stripe.price-ids.plan-bronze-yearly}")  private String bronzeYearly;
    @Value("${stripe.price-ids.plan-silver-monthly}") private String silverMonthly;
    @Value("${stripe.price-ids.plan-silver-yearly}")  private String silverYearly;
    @Value("${stripe.price-ids.plan-gold-monthly}")   private String goldMonthly;
    @Value("${stripe.price-ids.plan-gold-yearly}")    private String goldYearly;

    public StripeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Create Stripe Checkout Session ──────────────────────────────────────

    public String createCheckoutSession(String loginId, String planId,
                                        String billing, String successUrl,
                                        String cancelUrl) throws Exception {
        Stripe.apiKey = secretKey;

        String priceId    = resolvePriceId(planId, billing);
        String customerId = getOrCreateCustomer(loginId);

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customerId)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(priceId)
                        .setQuantity(1L)
                        .build())
                .putMetadata("loginId", loginId)
                .putMetadata("planId",  planId)
                .setSuccessUrl(successUrl + "?session_id={CHECKOUT_SESSION_ID}&upgraded=true")
                .setCancelUrl(cancelUrl)
                .build();

        Session session = Session.create(params);
        return session.getUrl();
    }

    // ─── Create Stripe Customer Portal Session ────────────────────────────────

    public String createPortalSession(String loginId, String returnUrl) throws Exception {
        Stripe.apiKey = secretKey;

        String customerId = getOrCreateCustomer(loginId);

        com.stripe.param.billingportal.SessionCreateParams params =
                com.stripe.param.billingportal.SessionCreateParams.builder()
                        .setCustomer(customerId)
                        .setReturnUrl(returnUrl)
                        .build();

        com.stripe.model.billingportal.Session portalSession =
                com.stripe.model.billingportal.Session.create(params);

        return portalSession.getUrl();
    }

    // ─── Handle incoming Stripe webhook ──────────────────────────────────────
    // Uses getRawJson() + GSON for deserialization to avoid API version
    // mismatch issues that cause getObject().isPresent() to return false.

    public void handleWebhook(String payload, String sigHeader) throws Exception {
        Stripe.apiKey = secretKey;

        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            System.err.println("[Stripe] Signature verification FAILED: " + e.getMessage());
            throw new Exception("Invalid Stripe webhook signature");
        }

        System.out.println("[Stripe] Webhook received: " + event.getType());

        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();

        switch (event.getType()) {

            // ── Primary: checkout completed ───────────────────────────────────
            case "checkout.session.completed" -> {
                try {
                    Session session = ApiResource.GSON.fromJson(
                            deserializer.getRawJson(), Session.class);
                    String loginId = session.getMetadata().get("loginId");
                    String planId  = session.getMetadata().get("planId");
                    System.out.println("[Stripe] checkout metadata — loginId: "
                            + loginId + " planId: " + planId);
                    if (loginId != null && planId != null) {
                        activatePlan(loginId, planId);
                    }
                } catch (Exception e) {
                    System.err.println("[Stripe] Failed to deserialize checkout.session.completed: "
                            + e.getMessage());
                }
            }

            // ── Fallback: subscription created ────────────────────────────────
            case "customer.subscription.created" -> {
                try {
                    Subscription sub = ApiResource.GSON.fromJson(
                            deserializer.getRawJson(), Subscription.class);
                    activatePlanFromSubscription(sub, "subscription.created");
                } catch (Exception e) {
                    System.err.println("[Stripe] Failed to deserialize subscription.created: "
                            + e.getMessage());
                }
            }

            // ── Fallback: subscription updated ────────────────────────────────
            case "customer.subscription.updated" -> {
                try {
                    Subscription sub = ApiResource.GSON.fromJson(
                            deserializer.getRawJson(), Subscription.class);
                    if ("active".equals(sub.getStatus())) {
                        activatePlanFromSubscription(sub, "subscription.updated");
                    }
                } catch (Exception e) {
                    System.err.println("[Stripe] Failed to deserialize subscription.updated: "
                            + e.getMessage());
                }
            }

            // ── Fallback: invoice payment — all 3 variants merged ─────────────
            case "invoice.paid", "invoice.payment_succeeded", "invoice_payment.paid" -> {
                try {
                    Invoice invoice = ApiResource.GSON.fromJson(
                            deserializer.getRawJson(), Invoice.class);
                    if (invoice.getSubscription() == null) break;

                    String customerId = invoice.getCustomer();
                    List<String> ids = jdbc.query(
                            "select id from login where stripe_customer_id = ?",
                            (rs, r) -> rs.getString("id"), customerId);

                    if (!ids.isEmpty()) {
                        String priceId = invoice.getLines().getData().get(0).getPrice().getId();
                        String planId  = resolvePlanIdFromPrice(priceId);
                        if (planId != null) {
                            activatePlan(ids.get(0), planId);
                            System.out.println("[Stripe] Plan activated via " + event.getType()
                                    + ": " + planId + " for " + ids.get(0));
                        }
                    }
                } catch (Exception e) {
                    System.err.println("[Stripe] Failed to deserialize " + event.getType()
                            + ": " + e.getMessage());
                }
            }

            // ── Cancellation: downgrade to free ───────────────────────────────
            case "customer.subscription.deleted" -> {
                try {
                    Subscription sub = ApiResource.GSON.fromJson(
                            deserializer.getRawJson(), Subscription.class);
                    String customerId = sub.getCustomer();
                    List<String> ids = jdbc.query(
                            "select id from login where stripe_customer_id = ?",
                            (rs, r) -> rs.getString("id"), customerId);
                    if (!ids.isEmpty()) {
                        activatePlan(ids.get(0), "plan-free");
                        System.out.println("[Stripe] Downgraded to free: " + ids.get(0));
                    }
                } catch (Exception e) {
                    System.err.println("[Stripe] Failed to deserialize subscription.deleted: "
                            + e.getMessage());
                }
            }

            default -> System.out.println("[Stripe] Unhandled event: " + event.getType());
        }
    }

    // ─── Activate plan in DB ──────────────────────────────────────────────────

    public void activatePlan(String loginId, String planId) {
        System.out.println("[Stripe] activatePlan() — loginId: " + loginId + " planId: " + planId);
        int rows = jdbc.update("""
                update login
                set plan_id          = ?,
                    tokens_remaining = (select max_tokens from plans where id = ?),
                    renew_date       = current_date + INTERVAL '30 days'
                where id = ?
                """, planId, planId, loginId);
        System.out.println("[Stripe] activatePlan() — updated " + rows + " rows");
    }

    // ─── Shared helper: activate plan from Subscription object ───────────────

    private void activatePlanFromSubscription(Subscription sub, String eventName) {
        String customerId = sub.getCustomer();
        List<String> ids = jdbc.query(
                "select id from login where stripe_customer_id = ?",
                (rs, r) -> rs.getString("id"), customerId);

        if (!ids.isEmpty()) {
            String planId = sub.getMetadata().get("planId");
            if (planId == null) {
                String priceId = sub.getItems().getData().get(0).getPrice().getId();
                planId = resolvePlanIdFromPrice(priceId);
            }
            if (planId != null) {
                activatePlan(ids.get(0), planId);
                System.out.println("[Stripe] Plan activated via " + eventName
                        + ": " + planId + " for " + ids.get(0));
            }
        }
    }

    // ─── Resolve planId + billing → Stripe Price ID ───────────────────────────

    private String resolvePriceId(String planId, String billing) {
        boolean yearly = "yearly".equalsIgnoreCase(billing);
        return switch (planId) {
            case "plan-bronze" -> yearly ? bronzeYearly : bronzeMonthly;
            case "plan-silver" -> yearly ? silverYearly : silverMonthly;
            case "plan-gold"   -> yearly ? goldYearly   : goldMonthly;
            default -> throw new IllegalArgumentException("Unknown planId: " + planId);
        };
    }

    // ─── Reverse lookup: Stripe Price ID → planId ────────────────────────────

    private String resolvePlanIdFromPrice(String priceId) {
        if (priceId == null) return null;
        if (priceId.equals(bronzeMonthly) || priceId.equals(bronzeYearly)) return "plan-bronze";
        if (priceId.equals(silverMonthly) || priceId.equals(silverYearly)) return "plan-silver";
        if (priceId.equals(goldMonthly)   || priceId.equals(goldYearly))   return "plan-gold";
        return null;
    }

    // ─── Get or create Stripe Customer ───────────────────────────────────────

    private String getOrCreateCustomer(String loginId) throws Exception {
        List<String> existing = jdbc.query(
                "select stripe_customer_id from login where id = ?",
                (rs, r) -> rs.getString("stripe_customer_id"), loginId);

        if (!existing.isEmpty() && existing.get(0) != null) {
            return existing.get(0);
        }

        var rows = jdbc.query(
                "select name, email from login where id = ?",
                (rs, r) -> Map.of(
                        "name",  rs.getString("name")  != null ? rs.getString("name")  : "",
                        "email", rs.getString("email") != null ? rs.getString("email") : loginId),
                loginId);

        String email = rows.isEmpty() ? loginId : (String) rows.get(0).get("email");
        String name  = rows.isEmpty() ? ""      : (String) rows.get(0).get("name");

        CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(email)
                .setName(name)
                .putMetadata("loginId", loginId)
                .build();

        Customer customer = Customer.create(params);

        jdbc.update("update login set stripe_customer_id = ? where id = ?",
                customer.getId(), loginId);

        return customer.getId();
    }
}