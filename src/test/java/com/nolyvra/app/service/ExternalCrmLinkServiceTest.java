package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ExternalCrmLinkServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ExternalCrmLinkService service = new ExternalCrmLinkService(jdbc);

    @Test
    void recordSuccessUpsertsExternalIdentityAndClearsError() {
        service.recordSuccess(
                "local@nolyvra.test", "hubspot", "client", "42",
                "company-123", "https://app.hubspot.com/contacts/1/company/company-123");

        verify(jdbc).update(
                argThat(sql -> sql.contains("on conflict")
                        && sql.contains("external_id = excluded.external_id")
                        && sql.contains("last_sync_error = null")),
                eq("local@nolyvra.test"), eq("hubspot"), eq("client"), eq("42"),
                eq("company-123"), eq("https://app.hubspot.com/contacts/1/company/company-123"));
    }

    @Test
    void recordFailureDoesNotOverwriteExistingExternalIdentity() {
        service.recordFailure(
                "local@nolyvra.test", "hubspot", "client", "42", "HubSpot unavailable");

        verify(jdbc).update(
                argThat(sql -> sql.contains("last_sync_status = 'failed'")
                        && !sql.contains("external_id = excluded.external_id")
                        && !sql.contains("external_url = excluded.external_url")),
                eq("local@nolyvra.test"), eq("hubspot"), eq("client"), eq("42"),
                eq("HubSpot unavailable"));
    }
}
