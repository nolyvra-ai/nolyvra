package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;

@Service
public class HubSpotClientSyncService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotClientSyncService.class);

    private static final String PROVIDER = "hubspot";
    private static final String LOCAL_TYPE = "client";

    private final ClientService clientService;
    private final HubSpotOAuthService oauthService;
    private final HubSpotCrmService crmService;
    private final ExternalCrmLinkService linkService;
    private final HubSpotCompanyMapper companyMapper;
    private final HubSpotContactSyncService contactSyncService;
    private final JdbcTemplate jdbc;

    public HubSpotClientSyncService(
            ClientService clientService,
            HubSpotOAuthService oauthService,
            HubSpotCrmService crmService,
            ExternalCrmLinkService linkService,
            HubSpotCompanyMapper companyMapper,
            HubSpotContactSyncService contactSyncService,
            JdbcTemplate jdbc) {
        this.clientService = clientService;
        this.oauthService = oauthService;
        this.crmService = crmService;
        this.linkService = linkService;
        this.companyMapper = companyMapper;
        this.contactSyncService = contactSyncService;
        this.jdbc = jdbc;
    }

    @Transactional
    public HubSpotSyncStatusResponse pushClient(Long clientId, String loginId) {
        ClientResponse client = clientService.getClientForHubSpot(clientId, loginId);
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before pushing a client");
        }

        String localId = clientId.toString();
        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, localId);
        ExternalCrmLink existing = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, localId);
        Map<String, String> properties = companyMapper.fromClient(client);

        log.info("[HubSpotSync] action=push localType=client localId={} loginId={} operation=start linked={}",
                localId, loginId, existing != null && existing.externalId() != null);
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
            log.info("[HubSpotSync] action=push localType=client localId={} loginId={} operation=success externalId={}",
                    localId, loginId, company.id());
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
                        HubSpotErrorSupport.userMessage(contactError));
            }
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, localId, message);
            log.warn("[HubSpotSync] action=push localType=client localId={} loginId={} operation=failed status={} message={}",
                    localId, loginId, HubSpotErrorSupport.responseStatus(e).value(), message);
            throw new ResponseStatusException(
                    HubSpotErrorSupport.responseStatus(e), message, e);
        }
    }

    @Transactional
    public HubSpotSyncStatusResponse syncClient(Long clientId, String loginId, String direction) {
        ClientResponse client = clientService.getClientForHubSpot(clientId, loginId);
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before syncing a client");
        }

        String localId = clientId.toString();
        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, localId);
        ExternalCrmLink link = linkService.findByLocalRecord(loginId, PROVIDER, LOCAL_TYPE, localId);
        HubSpotSyncSupport.requireLinked(link, "client");

        if (HubSpotSyncSupport.isPush(direction)) {
            return pushClient(clientId, loginId);
        }

        try {
            HubSpotCrmService.RemoteObject remote =
                    crmService.getCompanyForSync(loginId, link.externalId());
            if (HubSpotSyncSupport.isPull(direction)) {
                pullCompany(clientId, loginId, remote);
                ExternalCrmLink saved = linkService.recordSuccess(
                        loginId, PROVIDER, LOCAL_TYPE, localId, remote.id(),
                        externalUrl(connection.hubspotPortalId(), remote.id(), link.externalUrl()));
                return withContactStatus(saved, client, loginId);
            }

            Instant localUpdatedAt = localUpdatedAt("clients", "id", clientId, loginId);
            boolean localChanged = HubSpotSyncSupport.changedAfter(localUpdatedAt, link.lastSyncedAt());
            boolean remoteChanged = HubSpotSyncSupport.changedAfter(remote.updatedAt(), link.lastSyncedAt());
            if (localChanged && remoteChanged) {
                HubSpotSyncSupport.rejectConflict("client");
            }
            if (remoteChanged) {
                pullCompany(clientId, loginId, remote);
                ExternalCrmLink saved = linkService.recordSuccess(
                        loginId, PROVIDER, LOCAL_TYPE, localId, remote.id(),
                        externalUrl(connection.hubspotPortalId(), remote.id(), link.externalUrl()));
                return withContactStatus(saved, client, loginId);
            }
            if (localChanged) {
                return pushClient(clientId, loginId);
            }
            return withContactStatus(link, client, loginId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, localId, message);
            throw new ResponseStatusException(HubSpotErrorSupport.responseStatus(e), message, e);
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

    private HubSpotSyncStatusResponse withContactStatus(
            ExternalCrmLink companyLink, ClientResponse client, String loginId) {
        HubSpotSyncStatusResponse companyStatus = HubSpotSyncStatusResponse.fromLink(companyLink);
        if (client.contactEmail() == null || client.contactEmail().isBlank()) {
            return companyStatus.withContact("skipped", null, "Contact email is required");
        }
        ExternalCrmLink contactLink = linkService.findByLocalRecord(
                loginId, PROVIDER, HubSpotContactSyncService.LOCAL_TYPE, Long.toString(client.id()));
        if (contactLink == null) {
            return companyStatus.withContact("not_linked", null, null);
        }
        String contactState = "failed".equals(contactLink.lastSyncStatus()) ? "failed" : "success";
        return companyStatus.withContact(
                contactState, contactLink.externalUrl(), contactLink.lastSyncError());
    }

    private void pullCompany(Long clientId, String loginId, HubSpotCrmService.RemoteObject remote) {
        String name = HubSpotSyncSupport.property(remote.properties(), "name");
        String description = HubSpotSyncSupport.property(remote.properties(), "description");
        String linkedin = HubSpotSyncSupport.property(remote.properties(), "linkedin_company_page");
        jdbc.update("""
                update clients
                set company_name = coalesce(?, company_name),
                    notes = coalesce(?, notes),
                    linkedin_url = coalesce(?, linkedin_url),
                    updated_at = now()
                where id = ? and login_id = ?
                """, name, description, linkedin, clientId, loginId);
    }

    private Instant localUpdatedAt(String table, String idColumn, Object id, String loginId) {
        OffsetDateTime updatedAt = jdbc.queryForObject(
                "select updated_at from " + table + " where " + idColumn + " = ? and login_id = ?",
                OffsetDateTime.class, id, loginId);
        return updatedAt == null ? null : updatedAt.toInstant();
    }

    private String companyUrl(String portalId, String companyId) {
        if (portalId == null || portalId.isBlank()) return null;
        return "https://app.hubspot.com/contacts/" + portalId + "/company/" + companyId;
    }

    private String externalUrl(String portalId, String companyId, String fallback) {
        String url = companyUrl(portalId, companyId);
        return url == null ? fallback : url;
    }
}
