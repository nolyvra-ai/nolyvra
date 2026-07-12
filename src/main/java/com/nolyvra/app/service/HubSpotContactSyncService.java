package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class HubSpotContactSyncService {

    static final String LOCAL_TYPE = "client_contact";
    private static final String PROVIDER = "hubspot";

    private final HubSpotCrmService crmService;
    private final ExternalCrmLinkService linkService;
    private final HubSpotContactMapper contactMapper;

    public HubSpotContactSyncService(
            HubSpotCrmService crmService,
            ExternalCrmLinkService linkService,
            HubSpotContactMapper contactMapper) {
        this.crmService = crmService;
        this.linkService = linkService;
        this.contactMapper = contactMapper;
    }

    public ContactSyncResult upsertContact(
            ClientResponse client, String loginId, String portalId) throws Exception {
        Map<String, String> properties = contactMapper.fromClient(client);
        String email = properties.get("email");
        if (email == null || email.isBlank()) {
            return ContactSyncResult.skipped("Contact email is required");
        }

        String localId = Long.toString(client.id());
        ExternalCrmLink existing = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, localId);
        try {
            HubSpotCrmService.CrmObject contact;
            if (existing != null && existing.externalId() != null
                    && !existing.externalId().isBlank()) {
                contact = crmService.updateContact(loginId, existing.externalId(), properties);
            } else {
                HubSpotCrmService.CrmObject byEmail = crmService.findContactByEmail(loginId, email);
                contact = byEmail == null
                        ? crmService.createContact(loginId, properties)
                        : crmService.updateContact(loginId, byEmail.id(), properties);
            }

            String externalUrl = contact.url() != null && !contact.url().isBlank()
                    ? contact.url() : contactUrl(portalId, contact.id());
            ExternalCrmLink saved = linkService.recordSuccess(
                    loginId, PROVIDER, LOCAL_TYPE, localId,
                    contact.id(), externalUrl);
            return ContactSyncResult.success(saved.externalId(), saved.externalUrl());
        } catch (Exception e) {
            linkService.recordFailure(
                    loginId, PROVIDER, LOCAL_TYPE, localId, safeMessage(e));
            throw e;
        }
    }

    private String contactUrl(String portalId, String contactId) {
        if (portalId == null || portalId.isBlank()) return null;
        return "https://app.hubspot.com/contacts/" + portalId + "/contact/" + contactId;
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) return "HubSpot contact sync failed";
        return message.length() > 500 ? message.substring(0, 500) : message;
    }

    public record ContactSyncResult(
            String state, String externalId, String externalUrl, String error) {
        static ContactSyncResult success(String externalId, String externalUrl) {
            return new ContactSyncResult("success", externalId, externalUrl, null);
        }

        static ContactSyncResult skipped(String reason) {
            return new ContactSyncResult("skipped", null, null, reason);
        }
    }
}
