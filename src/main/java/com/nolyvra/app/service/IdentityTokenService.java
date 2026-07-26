package com.nolyvra.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class IdentityTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final String identityTokenSecret;

    public IdentityTokenService(@Value("${nexus.identity-token-secret:}") String identityTokenSecret) {
        this.identityTokenSecret = identityTokenSecret;
    }

    // ─── identityToken = HMAC-SHA256(lowercase(trim(email)), secret), hex ─────
    // Must match Nexus's derivation byte-for-byte — see docs/nexus-integration/shared-contracts.md

    public String compute(String email) {
        String normalized = email.trim().toLowerCase();
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(identityTokenSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] digest = mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Failed to compute identity token", e);
        }
    }
}
