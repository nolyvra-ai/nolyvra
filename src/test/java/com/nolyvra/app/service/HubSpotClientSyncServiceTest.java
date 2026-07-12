package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HubSpotClientSyncServiceTest {

    private final ClientService clientService = mock(ClientService.class);
    private final HubSpotOAuthService oauthService = mock(HubSpotOAuthService.class);
    private final HubSpotCrmService crmService = mock(HubSpotCrmService.class);
    private final ExternalCrmLinkService linkService = mock(ExternalCrmLinkService.class);
    private final HubSpotCompanyMapper mapper = mock(HubSpotCompanyMapper.class);
    private final HubSpotClientSyncService service = new HubSpotClientSyncService(
            clientService, oauthService, crmService, linkService, mapper);

    @Test
    void unlinkedClientCreatesCompanyAndStoresLink() throws Exception {
        ClientResponse client = client();
        HubSpotConnection connection = connection();
        ExternalCrmLink saved = link("company-1", "success", null);
        when(clientService.getClientForHubSpot(42L, "login-1")).thenReturn(client);
        when(oauthService.getConnection("login-1")).thenReturn(connection);
        when(mapper.fromClient(client)).thenReturn(Map.of("name", "Nolyvra"));
        when(crmService.createCompany(eq("login-1"), eq(Map.of("name", "Nolyvra"))))
                .thenReturn(new HubSpotCrmService.CrmObject("company-1", null));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "client", "42", "company-1",
                "https://app.hubspot.com/contacts/portal-1/company/company-1"))
                .thenReturn(saved);

        HubSpotSyncStatusResponse response = service.pushClient(42L, "login-1");

        assertThat(response.state()).isEqualTo("linked");
        verify(crmService).createCompany("login-1", Map.of("name", "Nolyvra"));
        verify(crmService, never()).updateCompany(anyString(), anyString(), eq(Map.of("name", "Nolyvra")));
    }

    @Test
    void linkedClientUpdatesExistingCompany() throws Exception {
        ClientResponse client = client();
        ExternalCrmLink existing = link("company-1", "success", null);
        when(clientService.getClientForHubSpot(42L, "login-1")).thenReturn(client);
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        when(linkService.findByLocalRecord("login-1", "hubspot", "client", "42"))
                .thenReturn(existing);
        when(mapper.fromClient(client)).thenReturn(Map.of("name", "Nolyvra"));
        when(crmService.updateCompany("login-1", "company-1", Map.of("name", "Nolyvra")))
                .thenReturn(new HubSpotCrmService.CrmObject("company-1", existing.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "client", "42", "company-1", existing.externalUrl()))
                .thenReturn(existing);

        service.pushClient(42L, "login-1");

        verify(crmService).updateCompany("login-1", "company-1", Map.of("name", "Nolyvra"));
        verify(crmService, never()).createCompany(eq("login-1"), eq(Map.of("name", "Nolyvra")));
    }

    @Test
    void repeatPushCreatesOnceThenUpdatesSameCompany() throws Exception {
        ClientResponse client = client();
        ExternalCrmLink linked = link("company-1", "success", null);
        Map<String, String> properties = Map.of("name", "Nolyvra");
        when(clientService.getClientForHubSpot(42L, "login-1")).thenReturn(client);
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        when(linkService.findByLocalRecord("login-1", "hubspot", "client", "42"))
                .thenReturn(null, linked);
        when(mapper.fromClient(client)).thenReturn(properties);
        when(crmService.createCompany("login-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("company-1", linked.externalUrl()));
        when(crmService.updateCompany("login-1", "company-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("company-1", linked.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "client", "42", "company-1", linked.externalUrl()))
                .thenReturn(linked);

        service.pushClient(42L, "login-1");
        service.pushClient(42L, "login-1");

        verify(crmService, times(1)).createCompany("login-1", properties);
        verify(crmService, times(1)).updateCompany("login-1", "company-1", properties);
    }

    @Test
    void failedPushRecordsFailure() throws Exception {
        ClientResponse client = client();
        when(clientService.getClientForHubSpot(42L, "login-1")).thenReturn(client);
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        when(mapper.fromClient(client)).thenReturn(Map.of("name", "Nolyvra"));
        when(crmService.createCompany("login-1", Map.of("name", "Nolyvra")))
                .thenThrow(new HubSpotCrmService.HubSpotApiException(400, "Invalid property"));

        assertThatThrownBy(() -> service.pushClient(42L, "login-1"))
                .hasMessageContaining("502 BAD_GATEWAY");
        verify(linkService).recordFailure(
                "login-1", "hubspot", "client", "42", "Invalid property");
    }

    @Test
    void statusDistinguishesDisconnectedAndConnectedNotLinked() {
        when(clientService.getClientForHubSpot(42L, "login-1")).thenReturn(client());

        assertThat(service.getStatus(42L, "login-1").state()).isEqualTo("disconnected");

        when(oauthService.getConnection("login-1")).thenReturn(connection());
        assertThat(service.getStatus(42L, "login-1").state()).isEqualTo("not_linked");
    }

    @Test
    void statusReturnsStoredFailureWithoutLosingLink() {
        when(clientService.getClientForHubSpot(42L, "login-1")).thenReturn(client());
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        when(linkService.findByLocalRecord("login-1", "hubspot", "client", "42"))
                .thenReturn(link("company-1", "failed", "Rate limited"));

        HubSpotSyncStatusResponse response = service.getStatus(42L, "login-1");

        assertThat(response.state()).isEqualTo("sync_failed");
        assertThat(response.linked()).isTrue();
        assertThat(response.lastSyncError()).isEqualTo("Rate limited");
    }

    private ClientResponse client() {
        return new ClientResponse(
                42L, "login-1", "Nolyvra", null, null, null,
                null, null, null, null, null, null, null,
                Instant.now(), 0, 0, 0, List.of(), List.of());
    }

    private HubSpotConnection connection() {
        return new HubSpotConnection(
                1L, "login-1", "portal-1", "Nolyvra", "user@nolyvra.test",
                "access", "refresh", Instant.now().plusSeconds(1800));
    }

    private ExternalCrmLink link(String externalId, String status, String error) {
        return new ExternalCrmLink(
                1L, "login-1", "hubspot", "client", "42", externalId,
                "https://app.hubspot.com/contacts/portal-1/company/" + externalId,
                Instant.now(), status, error);
    }
}
