package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HubSpotContactSyncServiceTest {

    private final HubSpotCrmService crmService = mock(HubSpotCrmService.class);
    private final ExternalCrmLinkService linkService = mock(ExternalCrmLinkService.class);
    private final HubSpotContactMapper mapper = mock(HubSpotContactMapper.class);
    private final HubSpotContactSyncService service =
            new HubSpotContactSyncService(crmService, linkService, mapper);

    @Test
    void linkedContactUpdatesByExternalId() throws Exception {
        ClientResponse client = client("ada@example.com");
        Map<String, String> properties = Map.of("email", "ada@example.com");
        ExternalCrmLink link = link("contact-1");
        when(mapper.fromClient(client)).thenReturn(properties);
        when(linkService.findByLocalRecord("login-1", "hubspot", "client_contact", "42"))
                .thenReturn(link);
        when(crmService.updateContact("login-1", "contact-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", link.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "client_contact", "42", "contact-1", link.externalUrl()))
                .thenReturn(link);

        HubSpotContactSyncService.ContactSyncResult result =
                service.upsertContact(client, "login-1", "portal-1");

        assertThat(result.state()).isEqualTo("success");
        verify(crmService).updateContact("login-1", "contact-1", properties);
        verify(crmService, never()).findContactByEmail("login-1", "ada@example.com");
    }

    @Test
    void unlinkedContactReusesEmailMatch() throws Exception {
        ClientResponse client = client("ada@example.com");
        Map<String, String> properties = Map.of("email", "ada@example.com");
        ExternalCrmLink saved = link("contact-1");
        when(mapper.fromClient(client)).thenReturn(properties);
        when(crmService.findContactByEmail("login-1", "ada@example.com"))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", null));
        when(crmService.updateContact("login-1", "contact-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", null));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "client_contact", "42", "contact-1",
                "https://app.hubspot.com/contacts/portal-1/contact/contact-1"))
                .thenReturn(saved);

        service.upsertContact(client, "login-1", "portal-1");

        verify(crmService, never()).createContact("login-1", properties);
        verify(crmService).updateContact("login-1", "contact-1", properties);
    }

    @Test
    void missingEmailSkipsContactSync() throws Exception {
        ClientResponse client = client(null);
        when(mapper.fromClient(client)).thenReturn(Map.of("firstname", "Ada"));

        HubSpotContactSyncService.ContactSyncResult result =
                service.upsertContact(client, "login-1", "portal-1");

        assertThat(result.state()).isEqualTo("skipped");
        assertThat(result.error()).isEqualTo("Contact email is required");
        verify(crmService, never()).createContact("login-1", Map.of("firstname", "Ada"));
    }

    @Test
    void associatesSyncedContactWithCompany() throws Exception {
        ClientResponse client = client("ada@example.com");
        Map<String, String> properties = Map.of("email", "ada@example.com");
        ExternalCrmLink link = link("contact-1");
        when(mapper.fromClient(client)).thenReturn(properties);
        when(linkService.findByLocalRecord("login-1", "hubspot", "client_contact", "42"))
                .thenReturn(link);
        when(crmService.updateContact("login-1", "contact-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", link.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "client_contact", "42", "contact-1", link.externalUrl()))
                .thenReturn(link);

        HubSpotContactSyncService.ContactSyncResult result = service.syncAndAssociate(
                client, "login-1", "portal-1", "company-1");

        assertThat(result.state()).isEqualTo("success");
        verify(crmService).associateContactToCompany("login-1", "contact-1", "company-1");
    }

    private ClientResponse client(String email) {
        return new ClientResponse(
                42L, "login-1", "Nolyvra", null, null, null,
                "Ada Lovelace", email, "CTO", null, null, null, null,
                Instant.now(), 0, 0, 0, List.of(), List.of());
    }

    private ExternalCrmLink link(String id) {
        return new ExternalCrmLink(
                1L, "login-1", "hubspot", "client_contact", "42", id,
                "https://app.hubspot.com/contacts/portal-1/contact/" + id,
                Instant.now(), "success", null);
    }
}
