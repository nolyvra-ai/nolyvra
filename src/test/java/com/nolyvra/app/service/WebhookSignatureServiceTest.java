package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class WebhookSignatureServiceTest {

    // Reference vector computed independently, outside this codebase:
    //   printf '%s' "the quick brown fox" | openssl dgst -sha256 -hmac "sig-secret" -hex
    // => 0dfbb92876422c5dca28c4a661a59b990ec675cd4278c082ceb65616a008ff9b
    private static final String KNOWN_SECRET = "sig-secret";
    private static final byte[] KNOWN_BODY = "the quick brown fox".getBytes(StandardCharsets.UTF_8);
    private static final String KNOWN_SIGNATURE =
            "0dfbb92876422c5dca28c4a661a59b990ec675cd4278c082ceb65616a008ff9b";

    private final WebhookSignatureService service = new WebhookSignatureService(KNOWN_SECRET);

    @Test
    void signMatchesIndependentlyComputedHmacVector() {
        assertThat(service.sign(KNOWN_BODY)).isEqualTo(KNOWN_SIGNATURE);
    }

    @Test
    void verifyAcceptsACorrectlySignedBody() {
        String signature = service.sign(KNOWN_BODY);

        assertThat(service.verify(KNOWN_BODY, signature)).isTrue();
    }

    @Test
    void verifyRejectsATamperedBody() {
        String signature = service.sign(KNOWN_BODY);
        byte[] tamperedBody = "the quick brown fax".getBytes(StandardCharsets.UTF_8);

        assertThat(service.verify(tamperedBody, signature)).isFalse();
    }

    @Test
    void verifyRejectsNullOrGarbageSignatureWithoutThrowing() {
        assertThat(service.verify(KNOWN_BODY, null)).isFalse();
        assertThat(service.verify(KNOWN_BODY, "not-valid-hex!!")).isFalse();
        assertThat(service.verify(KNOWN_BODY, "")).isFalse();
    }
}
