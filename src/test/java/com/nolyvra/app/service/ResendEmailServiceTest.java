package com.nolyvra.app.service;

import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class ResendEmailServiceTest {

    @Test
    void sendsPlainTextEmailWithConfiguredSender() {
        AtomicReference<String> usedApiKey = new AtomicReference<>();
        AtomicReference<CreateEmailOptions> sentOptions = new AtomicReference<>();
        ResendEmailService service = new ResendEmailService(
                "re_test_key",
                "Nolyvra <info@nolyvra.com>",
                (apiKey, options) -> {
                    usedApiKey.set(apiKey);
                    sentOptions.set(options);
                    return new CreateEmailResponse("email-1");
                });

        boolean sent = service.sendText(
                "user@example.com",
                "Reset your password",
                "Reset link");

        assertThat(sent).isTrue();
        assertThat(usedApiKey.get()).isEqualTo("re_test_key");
        assertThat(sentOptions.get().getFrom()).isEqualTo("Nolyvra <info@nolyvra.com>");
        assertThat(sentOptions.get().getTo()).containsExactly("user@example.com");
        assertThat(sentOptions.get().getSubject()).isEqualTo("Reset your password");
        assertThat(sentOptions.get().getText()).isEqualTo("Reset link");
        assertThat(sentOptions.get().getHtml()).isNull();
    }

    @Test
    void failsClosedWhenApiKeyIsMissing() {
        ResendEmailService service = new ResendEmailService(
                "",
                "Nolyvra <info@nolyvra.com>",
                (apiKey, options) -> {
                    throw new AssertionError("Sender must not be called");
                });

        assertThat(service.sendText("user@example.com", "Subject", "Body")).isFalse();
    }

    @Test
    void failsClosedWhenFromAddressIsMissing() {
        ResendEmailService service = new ResendEmailService(
                "re_test_key",
                "",
                (apiKey, options) -> {
                    throw new AssertionError("Sender must not be called");
                });

        assertThat(service.sendText("user@example.com", "Subject", "Body")).isFalse();
    }
}
