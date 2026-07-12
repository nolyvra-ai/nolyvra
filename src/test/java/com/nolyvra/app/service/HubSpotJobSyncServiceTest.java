package com.nolyvra.app.service;

import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import com.nolyvra.app.model.JobResponse;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HubSpotJobSyncServiceTest {

    private final JobService jobService = mock(JobService.class);
    private final HubSpotOAuthService oauthService = mock(HubSpotOAuthService.class);
    private final HubSpotCrmService crmService = mock(HubSpotCrmService.class);
    private final ExternalCrmLinkService linkService = mock(ExternalCrmLinkService.class);
    private final HubSpotDealMapper mapper = mock(HubSpotDealMapper.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final HubSpotJobSyncService service = new HubSpotJobSyncService(
            jobService, oauthService, crmService, linkService, mapper, jdbc);

    @Test
    void unlinkedJobCreatesDealAndAssociatesCompany() throws Exception {
        JobResponse job = job();
        ExternalCrmLink company = companyLink();
        ExternalCrmLink deal = dealLink("deal-1", "success", null);
        when(jobService.getJob("job-1", "login-1")).thenReturn(Optional.of(job));
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        whenClientLookupReturns(42L);
        when(linkService.findByLocalRecord("login-1", "hubspot", "client", "42")).thenReturn(company);
        when(mapper.fromJob(job)).thenReturn(Map.of(
                "dealname", "Senior Engineer", "pipeline", "default",
                "dealstage", "appointmentscheduled", "amount", "36000"));
        when(crmService.createDeal(eq("login-1"), any()))
                .thenReturn(new HubSpotCrmService.CrmObject("deal-1", null));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "job", "job-1", "deal-1",
                "https://app.hubspot.com/contacts/portal-1/deal/deal-1"))
                .thenReturn(deal);

        HubSpotSyncStatusResponse response = service.pushJob("job-1", "login-1");

        assertThat(response.state()).isEqualTo("linked");
        verify(crmService).createDeal(eq("login-1"), any());
        verify(crmService).associateDealToCompany("login-1", "deal-1", "company-1");
    }

    @Test
    void linkedJobUpdatesExistingDeal() throws Exception {
        JobResponse job = job();
        ExternalCrmLink existingDeal = dealLink("deal-1", "success", null);
        when(jobService.getJob("job-1", "login-1")).thenReturn(Optional.of(job));
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        whenClientLookupReturns(42L);
        when(linkService.findByLocalRecord("login-1", "hubspot", "client", "42"))
                .thenReturn(companyLink());
        when(linkService.findByLocalRecord("login-1", "hubspot", "job", "job-1"))
                .thenReturn(existingDeal);
        when(mapper.fromJob(job)).thenReturn(Map.of("dealname", "Senior Engineer"));
        when(crmService.updateDeal("login-1", "deal-1", Map.of("dealname", "Senior Engineer")))
                .thenReturn(new HubSpotCrmService.CrmObject("deal-1", existingDeal.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "job", "job-1", "deal-1", existingDeal.externalUrl()))
                .thenReturn(existingDeal);

        service.pushJob("job-1", "login-1");

        verify(crmService).updateDeal("login-1", "deal-1", Map.of("dealname", "Senior Engineer"));
        verify(crmService, never()).createDeal(anyString(), any());
    }

    @Test
    void associatesDealToContactWhenClientContactIsLinked() throws Exception {
        JobResponse job = job();
        ExternalCrmLink deal = dealLink("deal-1", "success", null);
        when(jobService.getJob("job-1", "login-1")).thenReturn(Optional.of(job));
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        whenClientLookupReturns(42L);
        when(linkService.findByLocalRecord("login-1", "hubspot", "client", "42"))
                .thenReturn(companyLink());
        when(linkService.findByLocalRecord("login-1", "hubspot", "client_contact", "42"))
                .thenReturn(contactLink());
        when(mapper.fromJob(job)).thenReturn(Map.of("dealname", "Senior Engineer"));
        when(crmService.createDeal("login-1", Map.of("dealname", "Senior Engineer")))
                .thenReturn(new HubSpotCrmService.CrmObject("deal-1", deal.externalUrl()));
        when(linkService.recordSuccess(
                "login-1", "hubspot", "job", "job-1", "deal-1", deal.externalUrl()))
                .thenReturn(deal);

        service.pushJob("job-1", "login-1");

        verify(crmService).associateDealToCompany("login-1", "deal-1", "company-1");
        verify(crmService).associateDealToContact("login-1", "deal-1", "contact-1");
    }

    @Test
    void missingCompanyLinkAsksUserToPushClientFirst() throws Exception {
        when(jobService.getJob("job-1", "login-1")).thenReturn(Optional.of(job()));
        when(oauthService.getConnection("login-1")).thenReturn(connection());
        whenClientLookupReturns(42L);

        assertThatThrownBy(() -> service.pushJob("job-1", "login-1"))
                .hasMessageContaining("Push client Nolyvra to HubSpot before pushing this job");
        verify(crmService, never()).createDeal(anyString(), any());
    }

    private void whenClientLookupReturns(Long clientId) {
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq("login-1"), eq("Nolyvra")))
                .thenReturn(clientId);
    }

    private JobResponse job() {
        return new JobResponse(
                "job-1", "Senior Engineer", "Nolyvra", "Full-time",
                null, "Build things", "Melbourne", List.of(), Instant.now(),
                "Active", new BigDecimal("180000.00"), "AUD",
                new BigDecimal("20.00"), new BigDecimal("36000.00"));
    }

    private HubSpotConnection connection() {
        return new HubSpotConnection(
                1L, "login-1", "portal-1", "Nolyvra", "user@nolyvra.test",
                "access", "refresh", Instant.now().plusSeconds(1800));
    }

    private ExternalCrmLink companyLink() {
        return new ExternalCrmLink(
                1L, "login-1", "hubspot", "client", "42", "company-1",
                "https://app.hubspot.com/contacts/portal-1/company/company-1",
                Instant.now(), "success", null);
    }

    private ExternalCrmLink dealLink(String externalId, String status, String error) {
        return new ExternalCrmLink(
                2L, "login-1", "hubspot", "job", "job-1", externalId,
                "https://app.hubspot.com/contacts/portal-1/deal/" + externalId,
                Instant.now(), status, error);
    }

    private ExternalCrmLink contactLink() {
        return new ExternalCrmLink(
                3L, "login-1", "hubspot", "client_contact", "42", "contact-1",
                "https://app.hubspot.com/contacts/portal-1/contact/contact-1",
                Instant.now(), "success", null);
    }
}
