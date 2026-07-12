package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class HubSpotClientSyncService {

    private static final String PROVIDER = "hubspot";
    private static final String LOCAL_TYPE = "client";

    private final ClientService clientService;
    private final HubSpotOAuthService oauthService;
    private final HubSpotCrmService crmService;
    private final ExternalCrmLinkService linkService;
    private final HubSpotCompanyMapper companyMapper;
    private final HubSpotContactSyncService contactSyncService;

    public HubSpotClientSyncService(
            ClientService clientService,
            HubSpotOAuthService oauthService,
            HubSpotCrmService crmService,
            ExternalCrmLinkService linkService,
            HubSpotCompanyMapper companyMapper,
            HubSpotContactSyncService contactSyncService) {
        this.clientService = clientService;
        this.oauthService = oauthService;
        this.crmService = crmService;
        this.linkService = linkService;
        this.companyMapper = companyMapper;
        this.contactSyncService = contactSyncService;
    }

    public HubSpotSyncStatusResponse pushClient(Long clientId, String loginId) {
        ClientResponse client = clientService.getClientForHubSpot(clientId, loginId);
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before pushing a client");
        }

        String localId = clientId.toString();
        ExternalCrmLink existing = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, localId);
        Map<String, String> properties = companyMapper.fromClient(client);

        try {
            HubSpotCrmService.CrmObject company = existing != null
                    && existing.externalId() != null && !existing.externalId().isBlank()
                    ? crmService.updateCompany(loginId, existing.externalId(), properties)
                    : crmService.createCompany(loginId, properties);
            String externalUrl = company.url() != null && !company.url().isBlank()
                    ? company.url()
                    : companyUrl(connection.hubspotPortalId(), company.id());
            ExternalCrmLink saved = linkService.recordSuccess(
                    loginId, PROVIDER, LOCAL_TYPE, localId,
                    company.id(), externalUrl);
            HubSpotSyncStatusResponse companyStatus = HubSpotSyncStatusResponse.fromLink(saved);
            try {
                HubSpotContactSyncService.ContactSyncResult contact =
                        contactSyncService.syncAndAssociate(
                                client, loginId, connection.hubspotPortalId(), company.id());
                return companyStatus.withContact(
                        contact.state(), contact.externalUrl(), contact.error());
            } catch (Exception contactError) {
                ExternalCrmLink contactLink = linkService.findByLocalRecord(
                        loginId, PROVIDER, HubSpotContactSyncService.LOCAL_TYPE, localId);
                return companyStatus.withContact(
                        "failed",
                        contactLink == null ? null : contactLink.externalUrl(),
                        safeMessage(contactError));
            }
        } catch (Exception e) {
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, localId, safeMessage(e));
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "HubSpot sync failed: " + safeMessage(e), e);
        }
    }

    public HubSpotSyncStatusResponse getStatus(Long clientId, String loginId) {
        ClientResponse client = clientService.getClientForHubSpot(clientId, loginId);
        if (oauthService.getConnection(loginId) == null) {
            return HubSpotSyncStatusResponse.disconnected();
        }
        ExternalCrmLink link = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, clientId.toString());
        HubSpotSyncStatusResponse companyStatus = link == null
                ? HubSpotSyncStatusResponse.notLinked()
                : HubSpotSyncStatusResponse.fromLink(link);
        if (client.contactEmail() == null || client.contactEmail().isBlank()) {
            return companyStatus.withContact("skipped", null, "Contact email is required");
        }
        ExternalCrmLink contactLink = linkService.findByLocalRecord(
                loginId, PROVIDER, HubSpotContactSyncService.LOCAL_TYPE, clientId.toString());
        if (contactLink == null) {
            return companyStatus.withContact("not_linked", null, null);
        }
        String contactState = "failed".equals(contactLink.lastSyncStatus()) ? "failed" : "success";
        return companyStatus.withContact(
                contactState, contactLink.externalUrl(), contactLink.lastSyncError());
    }

    private String companyUrl(String portalId, String companyId) {
        if (portalId == null || portalId.isBlank()) return null;
        return "https://app.hubspot.com/contacts/" + portalId + "/company/" + companyId;
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) return "HubSpot request failed";
        return message.length() > 500 ? message.substring(0, 500) : message;
    }
}
