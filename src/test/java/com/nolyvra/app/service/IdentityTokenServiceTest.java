package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IdentityTokenServiceTest {

    // Reference vector computed independently, outside this codebase:
    //   printf '%s' "test@example.com" | openssl dgst -sha256 -hmac "test-secret" -hex
    // => 04d4c4a9449d383577a0488be9bc871181165c41b8ecb4c2a188c89d20341bd4
    private static final String KNOWN_EMAIL = "test@example.com";
    private static final String KNOWN_SECRET = "test-secret";
    private static final String KNOWN_TOKEN =
            "04d4c4a9449d383577a0488be9bc871181165c41b8ecb4c2a188c89d20341bd4";

    @Test
    void matchesIndependentlyComputedHmacVector() {
        IdentityTokenService service = new IdentityTokenService(KNOWN_SECRET);

        assertThat(service.compute(KNOWN_EMAIL)).isEqualTo(KNOWN_TOKEN);
    }

    @Test
    void normalizesWhitespaceAndCaseBeforeHashing() {
        IdentityTokenService service = new IdentityTokenService(KNOWN_SECRET);

        assertThat(service.compute("  Foo@Bar.com "))
                .isEqualTo(service.compute("foo@bar.com"))
                .isEqualTo(service.compute("FOO@BAR.COM"));
    }

    @Test
    void differentSecretsProduceDifferentTokensForSameEmail() {
        // printf '%s' "test@example.com" | openssl dgst -sha256 -hmac "different-secret" -hex
        // => d1e011fa9e4c1ec6f3aefbd8f7c6a139a4d18ed6932fb96a9666dea0b570113b
        IdentityTokenService serviceA = new IdentityTokenService(KNOWN_SECRET);
        IdentityTokenService serviceB = new IdentityTokenService("different-secret");

        assertThat(serviceA.compute(KNOWN_EMAIL)).isNotEqualTo(serviceB.compute(KNOWN_EMAIL));
        assertThat(serviceB.compute(KNOWN_EMAIL))
                .isEqualTo("d1e011fa9e4c1ec6f3aefbd8f7c6a139a4d18ed6932fb96a9666dea0b570113b");
    }
}
