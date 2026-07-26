package com.nolyvra.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class WebhookSignatureService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final String signingSecret;

    public WebhookSignatureService(@Value("${nexus.webhook-signing-secret:}") String signingSecret) {
        this.signingSecret = signingSecret;
    }

    // ─── Outbound: sign the exact raw body bytes we're about to send ─────────

    public String sign(byte[] rawBody) {
        return HexFormat.of().formatHex(hmac(rawBody));
    }

    // ─── Inbound: verify X-Nolyvra-Signature against the exact raw body bytes
    // received, before any JSON parsing — constant-time compare to avoid timing
    // attacks. See docs/nexus-integration/shared-contracts.md's signing scheme.

    public boolean verify(byte[] rawBody, String signatureHeader) {
        if (signatureHeader == null) {
            return false;
        }
        byte[] provided;
        try {
            provided = HexFormat.of().parseHex(signatureHeader.trim().toLowerCase());
        } catch (IllegalArgumentException e) {
            return false;
        }
        return MessageDigest.isEqual(hmac(rawBody), provided);
    }

    private byte[] hmac(byte[] rawBody) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return mac.doFinal(rawBody);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Failed to compute HMAC signature", e);
        }
    }
}
