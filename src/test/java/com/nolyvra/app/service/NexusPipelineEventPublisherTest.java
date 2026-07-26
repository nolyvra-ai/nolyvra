package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NexusPipelineEventPublisherTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final IdentityTokenService identityTokenService = mock(IdentityTokenService.class);
    private final NexusClient nexusClient = mock(NexusClient.class);
    private final NexusPipelineEventPublisher publisher =
            new NexusPipelineEventPublisher(jdbc, identityTokenService, nexusClient);

    @SuppressWarnings("unchecked")
    private void stubEmail(String candidateId, String email) {
        when(nexusClient.isConfigured()).thenReturn(true);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(candidateId)))
                .thenReturn(List.of(email));
    }

    @Test
    void publishAddedToPipelineWritesAnOutboxRowWithComputedIdentityToken() {
        stubEmail("c1", "alice@example.com");
        when(identityTokenService.compute("alice@example.com")).thenReturn("tok-alice");

        publisher.publishAddedToPipeline("c1", "login-1");

        verify(jdbc).update(contains("insert into nexus_outbox_event"),
                eq("candidate.added_to_pipeline"), eq("tok-alice"), eq("login-1"), isNull(), any());
    }

    @Test
    void stageSelectedFiresPlacedNotStageChanged() {
        stubEmail("c1", "alice@example.com");
        when(identityTokenService.compute("alice@example.com")).thenReturn("tok-alice");

        publisher.publishStageChanged("c1", "login-1", "Selected");

        verify(jdbc).update(contains("insert into nexus_outbox_event"),
                eq("candidate.placed"), eq("tok-alice"), eq("login-1"), isNull(), any());
    }

    @Test
    void stageRejectedFiresRemovedFromPipeline() {
        stubEmail("c1", "alice@example.com");
        when(identityTokenService.compute("alice@example.com")).thenReturn("tok-alice");

        publisher.publishStageChanged("c1", "login-1", "Rejected");

        verify(jdbc).update(contains("insert into nexus_outbox_event"),
                eq("candidate.removed_from_pipeline"), eq("tok-alice"), eq("login-1"), isNull(), any());
    }

    @Test
    void otherStagesFireStageChangedWithTheStageFieldSet() {
        stubEmail("c1", "alice@example.com");
        when(identityTokenService.compute("alice@example.com")).thenReturn("tok-alice");

        publisher.publishStageChanged("c1", "login-1", "Interview");

        verify(jdbc).update(contains("insert into nexus_outbox_event"),
                eq("candidate.stage_changed"), eq("tok-alice"), eq("login-1"), eq("Interview"), any());
    }

    @SuppressWarnings("unchecked")
    @Test
    void skipsPublishingWhenCandidateHasNoEmailOnFile() {
        when(nexusClient.isConfigured()).thenReturn(true);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("c2"))).thenReturn(List.of());

        publisher.publishAddedToPipeline("c2", "login-1");

        verify(jdbc, never()).update(anyString(), any(), any(), any(), any(), any());
        verifyNoInteractions(identityTokenService);
    }

    @Test
    void skipsPublishingEntirelyWhenNexusIsDisabled() {
        // 2026-07-26 feature toggle: publish() must return before even querying the
        // candidate's email when Nexus is disabled/unconfigured — nothing should be
        // read from the DB or written to the outbox.
        when(nexusClient.isConfigured()).thenReturn(false);

        publisher.publishAddedToPipeline("c1", "login-1");

        verifyNoInteractions(jdbc);
        verifyNoInteractions(identityTokenService);
    }

    @SuppressWarnings("unchecked")
    @Test
    void neverThrowsEvenWhenTheDatabaseCallFails() {
        when(nexusClient.isConfigured()).thenReturn(true);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("c1")))
                .thenThrow(new RuntimeException("db down"));

        publisher.publishAddedToPipeline("c1", "login-1"); // must not throw
    }
}
