package com.nolyvra.app.service;

import com.nolyvra.app.model.EmployeeResponse;
import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class HubSpotEmployeeSyncService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotEmployeeSyncService.class);

    private static final String PROVIDER = "hubspot";
    private static final String LOCAL_TYPE = "employee";

    private final EmployeeService employeeService;
    private final HubSpotOAuthService oauthService;
    private final HubSpotCrmService crmService;
    private final ExternalCrmLinkService linkService;
    private final HubSpotContactMapper contactMapper;

    public HubSpotEmployeeSyncService(
            EmployeeService employeeService,
            HubSpotOAuthService oauthService,
            HubSpotCrmService crmService,
            ExternalCrmLinkService linkService,
            HubSpotContactMapper contactMapper) {
        this.employeeService = employeeService;
        this.oauthService = oauthService;
        this.crmService = crmService;
        this.linkService = linkService;
        this.contactMapper = contactMapper;
    }

    @Transactional
    public HubSpotSyncStatusResponse pushEmployee(String employeeId, String loginId) {
        EmployeeResponse employee = employeeService.getById(employeeId, loginId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Employee not found: " + employeeId));
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before pushing an employee");
        }

        Map<String, String> properties = contactMapper.fromEmployee(employee);
        String email = properties.get("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee email is required for HubSpot sync");
        }

        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, employeeId);
        ExternalCrmLink existing = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, employeeId);
        log.info("[HubSpotSync] action=push localType=employee localId={} loginId={} operation=start linked={}",
                employeeId, loginId, existing != null && existing.externalId() != null);
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
                    ? contact.url()
                    : contactUrl(connection.hubspotPortalId(), contact.id());
            ExternalCrmLink saved = linkService.recordSuccess(
                    loginId, PROVIDER, LOCAL_TYPE, employeeId,
                    contact.id(), externalUrl);
            log.info("[HubSpotSync] action=push localType=employee localId={} loginId={} operation=success externalId={}",
                    employeeId, loginId, contact.id());
            return HubSpotSyncStatusResponse.fromLink(saved);
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, employeeId, message);
            log.warn("[HubSpotSync] action=push localType=employee localId={} loginId={} operation=failed status={} message={}",
                    employeeId, loginId, HubSpotErrorSupport.responseStatus(e).value(), message);
            throw new ResponseStatusException(
                    HubSpotErrorSupport.responseStatus(e), message, e);
        }
    }

    public HubSpotSyncStatusResponse getStatus(String employeeId, String loginId) {
        employeeService.getById(employeeId, loginId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Employee not found: " + employeeId));
        if (oauthService.getConnection(loginId) == null) {
            return HubSpotSyncStatusResponse.disconnected();
        }
        ExternalCrmLink link = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, employeeId);
        return link == null ? HubSpotSyncStatusResponse.notLinked() : HubSpotSyncStatusResponse.fromLink(link);
    }

    private String contactUrl(String portalId, String contactId) {
        if (portalId == null || portalId.isBlank()) return null;
        return "https://app.hubspot.com/contacts/" + portalId + "/contact/" + contactId;
    }
}
