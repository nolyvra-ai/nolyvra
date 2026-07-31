package com.nolyvra.app.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ResendEmailService {

    private static final int MAX_ATTEMPTS = 4;
    private static final long INITIAL_BACKOFF_MS = 700L;

    private final String apiKey;
    private final String fromAddress;
    private final ResendSender sender;

    @Autowired
    public ResendEmailService(
            @Value("${resend.api-key:}") String apiKey,
            @Value("${resend.from:}") String fromAddress) {
        this(apiKey, fromAddress, (key, options) -> new Resend(key).emails().send(options));
    }

    ResendEmailService(String apiKey, String fromAddress, ResendSender sender) {
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
        this.sender = sender;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank()
                && !"re_xxxxxxxxx".equals(apiKey.trim())
                && fromAddress != null && !fromAddress.isBlank();
    }

    public boolean sendText(String toAddress, String subject, String body) {
        if (toAddress == null || toAddress.isBlank()) {
            return false;
        }
        if (apiKey == null || apiKey.isBlank() || "re_xxxxxxxxx".equals(apiKey.trim())) {
            System.err.println("Resend email skipped: RESEND_API_KEY is not configured.");
            return false;
        }
        if (fromAddress == null || fromAddress.isBlank()) {
            System.err.println("Resend email skipped: RESEND_FROM is not configured.");
            return false;
        }

        CreateEmailOptions options = CreateEmailOptions.builder()
                .from(fromAddress.trim())
                .to(toAddress)
                .subject(subject)
                .text(body)
                .build();

        long backoffMs = INITIAL_BACKOFF_MS;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                CreateEmailResponse response = sender.send(apiKey.trim(), options);
                System.out.println("System email sent via Resend to "
                        + toAddress + ": " + response.getId());
                return true;
            } catch (ResendException e) {
                boolean rateLimited = e.getStatusCode() != null && e.getStatusCode() == 429;
                if (!rateLimited || attempt == MAX_ATTEMPTS) {
                    System.err.println("Failed to send system email via Resend to "
                            + toAddress + ": " + e.getMessage());
                    return false;
                }
                sleepQuietly(backoffMs);
                backoffMs *= 2;
            } catch (Exception e) {
                System.err.println("Failed to send system email via Resend to "
                        + toAddress + ": " + e.getMessage());
                return false;
            }
        }
        return false;
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @FunctionalInterface
    interface ResendSender {
        CreateEmailResponse send(String apiKey, CreateEmailOptions options) throws ResendException;
    }
}
