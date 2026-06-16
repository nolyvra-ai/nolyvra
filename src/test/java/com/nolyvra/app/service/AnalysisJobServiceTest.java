package com.nolyvra.app.service;

import com.nolyvra.app.model.AnalysisJobBatchResponse;
import com.nolyvra.app.model.CandidateResponse;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AnalysisJobServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AnalysisService analysisService = mock(AnalysisService.class);
    private final AnalysisJobService service = new AnalysisJobService(jdbc, analysisService, 3, 3);

    @Test
    void enqueueBulkQueuesNewCandidatesAndSkipsExistingJobs() {
        when(jdbc.queryForObject(contains("select count(*) from analysis_jobs"), eq(Integer.class), eq("cand-new")))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("select count(*) from analysis_jobs"), eq(Integer.class), eq("cand-existing")))
                .thenReturn(1);
        when(jdbc.update(contains("insert into analysis_jobs"), any(), any(), any(), any()))
                .thenReturn(1);
        when(jdbc.query(contains("select status from analysis_jobs"), anyStatusMapper(), any(), any()))
                .thenReturn(List.of("queued"));

        AnalysisJobBatchResponse response = service.enqueueBulk(
                List.of("cand-new", "cand-new", "cand-existing", " "),
                "local@nolyvra.test");

        assertThat(response.queued()).isEqualTo(1);
        assertThat(response.running()).isZero();
        assertThat(response.succeeded()).isZero();
        assertThat(response.failed()).isZero();
        assertThat(response.skipped()).isEqualTo(1);
        assertThat(response.total()).isEqualTo(2);

        verify(jdbc, times(1)).update(
                contains("insert into analysis_jobs"),
                any(),
                eq("local@nolyvra.test"),
                eq("cand-new"),
                eq("local@nolyvra.test"));
        verify(jdbc, never()).update(
                contains("insert into analysis_jobs"),
                any(),
                eq("local@nolyvra.test"),
                eq("cand-existing"),
                eq("local@nolyvra.test"));
    }

    @Test
    void enqueueBulkQueuesOneHundredCandidatesWithoutRunningAnalysisInline() {
        List<String> candidateIds = IntStream.rangeClosed(1, 100)
                .mapToObj(i -> "cand-" + i)
                .toList();
        List<String> queuedStatuses = IntStream.rangeClosed(1, 100)
                .mapToObj(i -> "queued")
                .toList();

        when(jdbc.queryForObject(contains("select count(*) from analysis_jobs"), eq(Integer.class), anyString()))
                .thenReturn(0);
        when(jdbc.update(contains("insert into analysis_jobs"), any(), any(), any(), any()))
                .thenReturn(1);
        when(jdbc.query(contains("select status from analysis_jobs"), anyStatusMapper(), any(), any()))
                .thenReturn(queuedStatuses);

        AnalysisJobBatchResponse response = service.enqueueBulk(candidateIds, "local@nolyvra.test");

        assertThat(response.queued()).isEqualTo(100);
        assertThat(response.running()).isZero();
        assertThat(response.succeeded()).isZero();
        assertThat(response.failed()).isZero();
        assertThat(response.skipped()).isZero();
        assertThat(response.total()).isEqualTo(100);

        verify(jdbc, times(100)).update(
                contains("insert into analysis_jobs"),
                any(),
                eq("local@nolyvra.test"),
                startsWith("cand-"),
                eq("local@nolyvra.test"));
        verifyNoInteractions(analysisService);
    }

    @Test
    void processQueuedJobsRunsAnalysisAndMarksJobSucceeded() throws Exception {
        when(jdbc.query(contains("select id from analysis_jobs"), anyLongMapper(), eq(3)))
                .thenReturn(List.of(42L));
        when(jdbc.query(contains("returning id, candidate_id, login_id, attempts"), anyRowMapper(), eq(42L)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getLong("id")).thenReturn(42L);
                    when(rs.getString("candidate_id")).thenReturn("cand-1");
                    when(rs.getString("login_id")).thenReturn("local@nolyvra.test");
                    when(rs.getInt("attempts")).thenReturn(0);
                    return List.of(mapper.mapRow(rs, 0));
                });
        when(analysisService.getAIAnalysisForCandidate("cand-1")).thenReturn(null);
        CandidateResponse candidate = new CandidateResponse(
                "cand-1",
                "job-1",
                "Daniel Chen",
                "daniel@example.test",
                null,
                "",
                Instant.now(),
                "New",
                "CV text");
        when(analysisService.getJobIdNameForCandidate("cand-1")).thenReturn(candidate);

        service.processQueuedJobs();

        verify(jdbc).query(
                contains("set status = 'running'"),
                anyRowMapper(),
                eq(42L));
        verify(analysisService).analyze("cand-1", candidate, "local@nolyvra.test");
        verify(jdbc).update(
                contains("set status = 'succeeded'"),
                eq(42L));
    }

    @Test
    void processQueuedJobsLimitsOneHundredQueuedJobsToConfiguredParallelism() throws Exception {
        when(jdbc.query(contains("select id from analysis_jobs"), anyLongMapper(), eq(3)))
                .thenReturn(List.of(1L, 2L, 3L));
        when(jdbc.query(contains("returning id, candidate_id, login_id, attempts"), anyRowMapper(), anyLong()))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    Long id = invocation.getArgument(2);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getLong("id")).thenReturn(id);
                    when(rs.getString("candidate_id")).thenReturn("cand-" + id);
                    when(rs.getString("login_id")).thenReturn("local@nolyvra.test");
                    when(rs.getInt("attempts")).thenReturn(0);
                    return List.of(mapper.mapRow(rs, 0));
                });
        when(analysisService.getAIAnalysisForCandidate(startsWith("cand-"))).thenReturn(null);
        when(analysisService.getJobIdNameForCandidate(startsWith("cand-")))
                .thenAnswer(invocation -> {
                    String candidateId = invocation.getArgument(0);
                    return candidate(candidateId);
                });

        service.processQueuedJobs();

        verify(jdbc).query(contains("select id from analysis_jobs"), anyLongMapper(), eq(3));
        verify(analysisService, times(3)).analyze(
                startsWith("cand-"),
                any(CandidateResponse.class),
                eq("local@nolyvra.test"));
        verify(jdbc, times(3)).update(contains("set status = 'succeeded'"), anyLong());
    }

    private static CandidateResponse candidate(String candidateId) {
        return new CandidateResponse(
                candidateId,
                "job-1",
                "Candidate " + candidateId,
                candidateId + "@example.test",
                null,
                "",
                Instant.now(),
                "New",
                "CV text");
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<String> anyStatusMapper() {
        return any(RowMapper.class);
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<Long> anyLongMapper() {
        return any(RowMapper.class);
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<Object> anyRowMapper() {
        return any(RowMapper.class);
    }
}
