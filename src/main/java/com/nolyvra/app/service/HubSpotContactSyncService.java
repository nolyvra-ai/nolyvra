package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class HubSpotContactSyncService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotContactSyncService.class);

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

    @Transactional
    public ContactSyncResult upsertContact(
            ClientResponse client, String loginId, String portalId) throws Exception {
        Map<String, String> properties = contactMapper.fromClient(client);
        String email = properties.get("email");
        if (email == null || email.isBlank()) {
            return ContactSyncResult.skipped("Contact email is required");
        }

        String localId = Long.toString(client.id());
        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, localId);
        ExternalCrmLink existing = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, localId);
        log.info("[HubSpotSync] action=push localType=client_contact localId={} loginId={} operation=start linked={}",
                localId, loginId, existing != null && existing.externalId() != null);
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
            log.info("[HubSpotSync] action=push localType=client_contact localId={} loginId={} operation=success externalId={}",
                    localId, loginId, contact.id());
            return ContactSyncResult.success(saved.externalId(), saved.externalUrl());
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(
                    loginId, PROVIDER, LOCAL_TYPE, localId, message);
            log.warn("[HubSpotSync] action=push localType=client_contact localId={} loginId={} operation=failed status={} message={}",
                    localId, loginId, HubSpotErrorSupport.responseStatus(e).value(), message);
            throw e;
        }
    }

    public ContactSyncResult syncAndAssociate(
            ClientResponse client, String loginId, String portalId, String companyId) throws Exception {
        ContactSyncResult contact = upsertContact(client, loginId, portalId);
        if (!"success".equals(contact.state())) return contact;

        try {
            crmService.associateContactToCompany(loginId, contact.externalId(), companyId);
            return contact;
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(
                    loginId, PROVIDER, LOCAL_TYPE, Long.toString(client.id()), message);
            log.warn("[HubSpotSync] action=associate localType=client_contact localId={} loginId={} operation=failed status={} message={}",
                    client.id(), loginId, HubSpotErrorSupport.responseStatus(e).value(), message);
            throw e;
        }
    }

    private String contactUrl(String portalId, String contactId) {
        if (portalId == null || portalId.isBlank()) return null;
        return "https://app.hubspot.com/contacts/" + portalId + "/contact/" + contactId;
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
