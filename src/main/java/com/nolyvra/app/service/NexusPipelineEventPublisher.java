package com.nolyvra.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;

// Writes pipeline events to the outbox (nexus_outbox_event) for
// NexusOutboxDispatcher to deliver. Called from CandidatesController right next
// to the existing workflowService.recordEvent(...) calls — see the Step 6 design
// note in .claude/sprint-context.md for why this touches an existing controller
// (unlike every prior step) and the stage-to-eventType mapping.
//
// Never throws — a failure to publish must never break the recruiter's real
// action (adding a candidate, changing a stage).
@Service
public class NexusPipelineEventPublisher {

    private final JdbcTemplate jdbc;
    private final IdentityTokenService identityTokenService;
    private final NexusClient nexusClient;

    public NexusPipelineEventPublisher(
            JdbcTemplate jdbc, IdentityTokenService identityTokenService, NexusClient nexusClient) {
        this.jdbc = jdbc;
        this.identityTokenService = identityTokenService;
        this.nexusClient = nexusClient;
    }

    public void publishAddedToPipeline(String candidateId, String loginId) {
        publish(candidateId, loginId, "candidate.added_to_pipeline", null);
    }

    public void publishStageChanged(String candidateId, String loginId, String newStage) {
        String eventType = switch (newStage == null ? "" : newStage) {
            case "Selected" -> "candidate.placed";
            case "Rejected" -> "candidate.removed_from_pipeline";
            default -> "candidate.stage_changed";
        };
        String stageField = "candidate.stage_changed".equals(eventType) ? newStage : null;
        publish(candidateId, loginId, eventType, stageField);
    }

    private void publish(String candidateId, String loginId, String eventType, String stage) {
        if (!nexusClient.isConfigured()) {
            return; // Nexus integration disabled or unconfigured — nothing to publish
        }
        try {
            String email = jdbc.query(
                    "select email from candidates where id = ?",
                    (rs, i) -> rs.getString("email"), candidateId)
                    .stream().findFirst().orElse(null);
            if (email == null || email.isBlank()) {
                System.out.println("[NexusPipelineEventPublisher] skipping " + eventType + " for candidate "
                        + candidateId + " — no email on file (nothing to compute identityToken from)");
                return; // no email on file — nothing meaningful to send, not a failure
            }
            String identityToken = identityTokenService.compute(email);
            jdbc.update("""
                    insert into nexus_outbox_event
                        (event_type, identity_token, tenant_ref, stage, occurred_at)
                    values (?, ?, ?, ?, ?)
                    """,
                    eventType, identityToken, loginId, stage, Timestamp.from(Instant.now()));
            System.out.println("[NexusPipelineEventPublisher] queued " + eventType + " for candidate "
                    + candidateId + " identityToken=" + identityToken + " tenantRef=" + loginId
                    + (stage != null ? " stage=" + stage : ""));
        } catch (Exception e) {
            System.err.println("[NexusPipelineEventPublisher] failed to publish " + eventType
                    + " for candidate " + candidateId + ": " + e.getMessage());
        }
    }
}
