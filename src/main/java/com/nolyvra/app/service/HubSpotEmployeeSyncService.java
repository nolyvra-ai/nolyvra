package com.nolyvra.app.service;

import com.nolyvra.app.model.EmployeeResponse;
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
public class HubSpotEmployeeSyncService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotEmployeeSyncService.class);

    private static final String PROVIDER = "hubspot";
    private static final String LOCAL_TYPE = "employee";

    private final EmployeeService employeeService;
    private final HubSpotOAuthService oauthService;
    private final HubSpotCrmService crmService;
    private final ExternalCrmLinkService linkService;
    private final HubSpotContactMapper contactMapper;
    private final JdbcTemplate jdbc;

    public HubSpotEmployeeSyncService(
            EmployeeService employeeService,
            HubSpotOAuthService oauthService,
            HubSpotCrmService crmService,
            ExternalCrmLinkService linkService,
            HubSpotContactMapper contactMapper,
            JdbcTemplate jdbc) {
        this.employeeService = employeeService;
        this.oauthService = oauthService;
        this.crmService = crmService;
        this.linkService = linkService;
        this.contactMapper = contactMapper;
        this.jdbc = jdbc;
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

    @Transactional
    public HubSpotSyncStatusResponse syncEmployee(String employeeId, String loginId, String direction) {
        employeeService.getById(employeeId, loginId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Employee not found: " + employeeId));
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before syncing an employee");
        }

        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, employeeId);
        ExternalCrmLink link = linkService.findByLocalRecord(loginId, PROVIDER, LOCAL_TYPE, employeeId);
        HubSpotSyncSupport.requireLinked(link, "employee");

        if (HubSpotSyncSupport.isPush(direction)) {
            return pushEmployee(employeeId, loginId);
        }

        try {
            HubSpotCrmService.RemoteObject remote =
                    crmService.getContactForSync(loginId, link.externalId());
            if (HubSpotSyncSupport.isPull(direction)) {
                pullContact(employeeId, loginId, remote);
                ExternalCrmLink saved = linkService.recordSuccess(
                        loginId, PROVIDER, LOCAL_TYPE, employeeId,
                        remote.id(), externalUrl(connection.hubspotPortalId(), remote.id(), link.externalUrl()));
                return HubSpotSyncStatusResponse.fromLink(saved);
            }

            Instant localUpdatedAt = localUpdatedAt(employeeId, loginId);
            boolean localChanged = HubSpotSyncSupport.changedAfter(localUpdatedAt, link.lastSyncedAt());
            boolean remoteChanged = HubSpotSyncSupport.changedAfter(remote.updatedAt(), link.lastSyncedAt());
            if (localChanged && remoteChanged) {
                HubSpotSyncSupport.rejectConflict("employee");
            }
            if (remoteChanged) {
                pullContact(employeeId, loginId, remote);
                ExternalCrmLink saved = linkService.recordSuccess(
                        loginId, PROVIDER, LOCAL_TYPE, employeeId,
                        remote.id(), externalUrl(connection.hubspotPortalId(), remote.id(), link.externalUrl()));
                return HubSpotSyncStatusResponse.fromLink(saved);
            }
            if (localChanged) {
                return pushEmployee(employeeId, loginId);
            }
            return HubSpotSyncStatusResponse.fromLink(link);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, employeeId, message);
            throw new ResponseStatusException(HubSpotErrorSupport.responseStatus(e), message, e);
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

    private void pullContact(String employeeId, String loginId, HubSpotCrmService.RemoteObject remote) {
        String firstName = HubSpotSyncSupport.property(remote.properties(), "firstname");
        String lastName = HubSpotSyncSupport.property(remote.properties(), "lastname");
        String email = HubSpotSyncSupport.property(remote.properties(), "email");
        String phone = HubSpotSyncSupport.property(remote.properties(), "phone");
        String jobTitle = HubSpotSyncSupport.property(remote.properties(), "jobtitle");
        jdbc.update("""
                update employees
                set first_name = coalesce(?, first_name),
                    last_name = coalesce(?, last_name),
                    email = coalesce(?, email),
                    phone = coalesce(?, phone),
                    job_title = coalesce(?, job_title),
                    updated_at = now()
                where id = ? and login_id = ? and is_active = true
                """, firstName, lastName, email, phone, jobTitle, employeeId, loginId);
    }

    private Instant localUpdatedAt(String employeeId, String loginId) {
        OffsetDateTime updatedAt = jdbc.queryForObject("""
                select updated_at
                from employees
                where id = ? and login_id = ? and is_active = true
                """, OffsetDateTime.class, employeeId, loginId);
        return updatedAt == null ? null : updatedAt.toInstant();
    }

    private String externalUrl(String portalId, String contactId, String fallback) {
        String url = contactUrl(portalId, contactId);
        return url == null ? fallback : url;
    }
}
