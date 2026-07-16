package com.nolyvra.app.service;

import com.nolyvra.app.model.EmployeeResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HubSpotEmployeeSyncServiceTest {

    private final EmployeeService employeeService = mock(EmployeeService.class);
    private final HubSpotOAuthService oauthService = mock(HubSpotOAuthService.class);
    private final HubSpotCrmService crmService = mock(HubSpotCrmService.class);
    private final ExternalCrmLinkService linkService = mock(ExternalCrmLinkService.class);
    private final HubSpotContactMapper mapper = mock(HubSpotContactMapper.class);
    private final HubSpotEmployeeSyncService service = new HubSpotEmployeeSyncService(
            employeeService, oauthService, crmService, linkService, mapper);

    @Test
    void unlinkedEmployeeReusesEmailMatch() throws Exception {
        EmployeeResponse employee = employee();
        Map<String, String> properties = Map.of("email", "ada@example.com");
        ExternalCrmLink saved = link("contact-1", "success", null);
        when(employeeService.getById("emp-1", "login-1")).thenReturn(Optional.of(employee));
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        when(mapper.fromEmployee(employee)).thenReturn(properties);
        when(crmService.findContactByEmail("login-1", "ada@example.com"))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", null));
        when(crmService.updateContact("login-1", "contact-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", null));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "employee", "emp-1", "contact-1",
                "https://app.hubspot.com/contacts/portal-1/contact/contact-1"))
                .thenReturn(saved);

        HubSpotSyncStatusResponse response = service.pushEmployee("emp-1", "login-1");

        assertThat(response.state()).isEqualTo("linked");
        verify(crmService).updateContact("login-1", "contact-1", properties);
        verify(crmService, never()).createContact("login-1", properties);
    }

    @Test
    void linkedEmployeeUpdatesExistingContact() throws Exception {
        EmployeeResponse employee = employee();
        Map<String, String> properties = Map.of("email", "ada@example.com");
        ExternalCrmLink existing = link("contact-1", "success", null);
        when(employeeService.getById("emp-1", "login-1")).thenReturn(Optional.of(employee));
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        when(mapper.fromEmployee(employee)).thenReturn(properties);
        when(linkService.findByLocalRecord("login-1", "hubspot", "employee", "emp-1"))
                .thenReturn(existing);
        when(crmService.updateContact("login-1", "contact-1", properties))
                .thenReturn(new HubSpotCrmService.CrmObject("contact-1", existing.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "employee", "emp-1", "contact-1", existing.externalUrl()))
                .thenReturn(existing);

        service.pushEmployee("emp-1", "login-1");

        verify(crmService).updateContact("login-1", "contact-1", properties);
        verify(crmService, never()).findContactByEmail("login-1", "ada@example.com");
    }

    @Test
    void statusDistinguishesDisconnectedAndConnectedNotLinked() {
        when(employeeService.getById("emp-1", "login-1")).thenReturn(Optional.of(employee()));

        assertThat(service.getStatus("emp-1", "login-1").state()).isEqualTo("disconnected");

        when(oauthService.getConnection("login-1")).thenReturn(connection());
        assertThat(service.getStatus("emp-1", "login-1").state()).isEqualTo("not_linked");
    }

    private EmployeeResponse employee() {
        return new EmployeeResponse(
                "emp-1", "login-1", null, "Ada", "Lovelace",
                "ada@example.com", "+61 400 000 000", "Engineer",
                "PERMANENT", "ACTIVE", null, null, null, null,
                LocalDate.now(), null, BigDecimal.TEN, null, null,
                Instant.now(), Instant.now());
    }

    private HubSpotConnection connection() {
        return new HubSpotConnection(
                1L, "login-1", "portal-1", "Nolyvra", "user@nolyvra.test",
                "access", "refresh", Instant.now().plusSeconds(1800));
    }

    private ExternalCrmLink link(String externalId, String status, String error) {
        return new ExternalCrmLink(
                1L, "login-1", "hubspot", "employee", "emp-1", externalId,
                "https://app.hubspot.com/contacts/portal-1/contact/" + externalId,
                Instant.now(), status, error);
    }
}
