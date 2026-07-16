package com.nolyvra.app.service;

import com.nolyvra.app.model.ExternalCrmLink;
import com.nolyvra.app.model.HubSpotConnection;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import com.nolyvra.app.model.JobResponse;
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
public class HubSpotJobSyncService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotJobSyncService.class);

    private static final String PROVIDER = "hubspot";
    private static final String LOCAL_TYPE = "job";
    private static final String CLIENT_LOCAL_TYPE = "client";

    private final JobService jobService;
    private final HubSpotOAuthService oauthService;
    private final HubSpotCrmService crmService;
    private final ExternalCrmLinkService linkService;
    private final HubSpotDealMapper dealMapper;
    private final JdbcTemplate jdbc;

    public HubSpotJobSyncService(
            JobService jobService,
            HubSpotOAuthService oauthService,
            HubSpotCrmService crmService,
            ExternalCrmLinkService linkService,
            HubSpotDealMapper dealMapper,
            JdbcTemplate jdbc) {
        this.jobService = jobService;
        this.oauthService = oauthService;
        this.crmService = crmService;
        this.linkService = linkService;
        this.dealMapper = dealMapper;
        this.jdbc = jdbc;
    }

    @Transactional
    public HubSpotSyncStatusResponse syncJob(String jobId, String loginId, String direction) {
        getJob(jobId, loginId);
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before syncing a job");
        }

        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, jobId);
        ExternalCrmLink link = linkService.findByLocalRecord(loginId, PROVIDER, LOCAL_TYPE, jobId);
        HubSpotSyncSupport.requireLinked(link, "job");

        if (HubSpotSyncSupport.isPush(direction)) {
            return pushJob(jobId, loginId);
        }

        try {
            HubSpotCrmService.RemoteObject remote = crmService.getDealForSync(loginId, link.externalId());
            if (HubSpotSyncSupport.isPull(direction)) {
                pullDeal(jobId, loginId, remote);
                ExternalCrmLink saved = linkService.recordSuccess(
                        loginId, PROVIDER, LOCAL_TYPE, jobId,
                        remote.id(), externalUrl(connection.hubspotPortalId(), remote.id(), link.externalUrl()));
                return HubSpotSyncStatusResponse.fromLink(saved);
            }

            Instant localUpdatedAt = localUpdatedAt(jobId, loginId);
            boolean localChanged = HubSpotSyncSupport.changedAfter(localUpdatedAt, link.lastSyncedAt());
            boolean remoteChanged = HubSpotSyncSupport.changedAfter(remote.updatedAt(), link.lastSyncedAt());
            if (localChanged && remoteChanged) {
                HubSpotSyncSupport.rejectConflict("job");
            }
            if (remoteChanged) {
                pullDeal(jobId, loginId, remote);
                ExternalCrmLink saved = linkService.recordSuccess(
                        loginId, PROVIDER, LOCAL_TYPE, jobId,
                        remote.id(), externalUrl(connection.hubspotPortalId(), remote.id(), link.externalUrl()));
                return HubSpotSyncStatusResponse.fromLink(saved);
            }
            if (localChanged) {
                return pushJob(jobId, loginId);
            }
            return HubSpotSyncStatusResponse.fromLink(link);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, jobId, message);
            throw new ResponseStatusException(HubSpotErrorSupport.responseStatus(e), message, e);
        }
    }

    @Transactional
    public HubSpotSyncStatusResponse pushJob(String jobId, String loginId) {
        JobResponse job = getJob(jobId, loginId);
        HubSpotConnection connection = oauthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect HubSpot before pushing a job");
        }

        Long clientId = findClientId(job, loginId);
        ExternalCrmLink companyLink = findRequiredCompanyLink(loginId, clientId, job.company());
        linkService.acquireLocalRecordLock(loginId, PROVIDER, LOCAL_TYPE, jobId);
        ExternalCrmLink existing = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, jobId);
        Map<String, String> properties = dealMapper.fromJob(job);

        log.info("[HubSpotSync] action=push localType=job localId={} loginId={} operation=start linked={}",
                jobId, loginId, existing != null && existing.externalId() != null);
        try {
            HubSpotCrmService.CrmObject deal = existing != null
                    && existing.externalId() != null && !existing.externalId().isBlank()
                    ? crmService.updateDeal(loginId, existing.externalId(), properties)
                    : crmService.createDeal(loginId, properties);
            String externalUrl = deal.url() != null && !deal.url().isBlank()
                    ? deal.url()
                    : dealUrl(connection.hubspotPortalId(), deal.id());
            ExternalCrmLink saved = linkService.recordSuccess(
                    loginId, PROVIDER, LOCAL_TYPE, jobId, deal.id(), externalUrl);
            associateDeal(loginId, deal.id(), companyLink, clientId);
            log.info("[HubSpotSync] action=push localType=job localId={} loginId={} operation=success externalId={}",
                    jobId, loginId, deal.id());
            return HubSpotSyncStatusResponse.fromLink(saved);
        } catch (Exception e) {
            String message = HubSpotErrorSupport.userMessage(e);
            linkService.recordFailure(loginId, PROVIDER, LOCAL_TYPE, jobId, message);
            log.warn("[HubSpotSync] action=push localType=job localId={} loginId={} operation=failed status={} message={}",
                    jobId, loginId, HubSpotErrorSupport.responseStatus(e).value(), message);
            throw new ResponseStatusException(
                    HubSpotErrorSupport.responseStatus(e), message, e);
        }
    }

    public HubSpotSyncStatusResponse getStatus(String jobId, String loginId) {
        getJob(jobId, loginId);
        if (oauthService.getConnection(loginId) == null) {
            return HubSpotSyncStatusResponse.disconnected();
        }
        ExternalCrmLink link = linkService.findByLocalRecord(
                loginId, PROVIDER, LOCAL_TYPE, jobId);
        return link == null ? HubSpotSyncStatusResponse.notLinked() : HubSpotSyncStatusResponse.fromLink(link);
    }

    private void associateDeal(
            String loginId, String dealId, ExternalCrmLink companyLink, Long clientId) throws Exception {
        crmService.associateDealToCompany(loginId, dealId, companyLink.externalId());
        ExternalCrmLink contactLink = linkService.findByLocalRecord(
                loginId, PROVIDER, HubSpotContactSyncService.LOCAL_TYPE, clientId.toString());
        if (contactLink != null
                && contactLink.externalId() != null && !contactLink.externalId().isBlank()
                && "success".equals(contactLink.lastSyncStatus())) {
            crmService.associateDealToContact(loginId, dealId, contactLink.externalId());
        }
    }

    private JobResponse getJob(String jobId, String loginId) {
        return jobService.getJob(jobId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
    }

    private Long findClientId(JobResponse job, String loginId) {
        if (job.company() == null || job.company().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Job needs a client company before it can be pushed to HubSpot");
        }
        Long clientId = jdbc.query("""
                select id
                from clients
                where login_id = ? and lower(company_name) = lower(?)
                order by created_at desc
                limit 1
                """, rs -> rs.next() ? rs.getLong("id") : null,
                loginId, job.company());
        if (clientId == null) {
            throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Create or push the matching client before pushing this job to HubSpot");
        }
        return clientId;
    }

    private ExternalCrmLink findRequiredCompanyLink(String loginId, Long clientId, String companyName) {
        ExternalCrmLink link = linkService.findByLocalRecord(
                loginId, PROVIDER, CLIENT_LOCAL_TYPE, clientId.toString());
        if (link == null || link.externalId() == null || link.externalId().isBlank()
                || !"success".equals(link.lastSyncStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Push client " + companyName + " to HubSpot before pushing this job");
        }
        return link;
    }

    private String dealUrl(String portalId, String dealId) {
        if (portalId == null || portalId.isBlank()) return null;
        return "https://app.hubspot.com/contacts/" + portalId + "/deal/" + dealId;
    }

    private void pullDeal(String jobId, String loginId, HubSpotCrmService.RemoteObject remote) {
        String dealName = HubSpotSyncSupport.property(remote.properties(), "dealname");
        jdbc.update("""
                update jobs
                set title = coalesce(?, title),
                    updated_at = now()
                where id = ? and login_id = ? and is_active = true
                """, dealName, jobId, loginId);
    }

    private Instant localUpdatedAt(String jobId, String loginId) {
        OffsetDateTime updatedAt = jdbc.queryForObject("""
                select updated_at
                from jobs
                where id = ? and login_id = ? and is_active = true
                """, OffsetDateTime.class, jobId, loginId);
        return updatedAt == null ? null : updatedAt.toInstant();
    }

    private String externalUrl(String portalId, String dealId, String fallback) {
        String url = dealUrl(portalId, dealId);
        return url == null ? fallback : url;
    }
}
