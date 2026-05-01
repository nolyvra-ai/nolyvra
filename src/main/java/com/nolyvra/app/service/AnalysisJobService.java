package com.nolyvra.app.service;

import com.nolyvra.app.model.AnalysisJobBatchResponse;
import com.nolyvra.app.model.CandidateAnalysisResponse;
import com.nolyvra.app.model.CandidateResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class AnalysisJobService {

    private final JdbcTemplate jdbc;
    private final AnalysisService analysisService;
    private final int maxParallelJobs;
    private final int maxAttempts;
    private final AtomicBoolean workerRunning = new AtomicBoolean(false);

    public AnalysisJobService(
            JdbcTemplate jdbc,
            AnalysisService analysisService,
            @Value("${analysis-jobs.max-parallel:3}") int maxParallelJobs,
            @Value("${analysis-jobs.max-attempts:3}") int maxAttempts) {
        this.jdbc = jdbc;
        this.analysisService = analysisService;
        this.maxParallelJobs = maxParallelJobs;
        this.maxAttempts = maxAttempts;
    }

    public AnalysisJobBatchResponse enqueueBulk(List<String> candidateIds, String loginId) {
        if (candidateIds == null || candidateIds.isEmpty()) {
            return new AnalysisJobBatchResponse(UUID.randomUUID().toString(), 0, 0, 0, 0, 0, 0);
        }

        String batchId = UUID.randomUUID().toString();
        int queued = 0;
        int skipped = 0;

        for (String candidateId : candidateIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList()) {
            Integer exists = jdbc.queryForObject("""
                    select count(*) from analysis_jobs
                    where candidate_id = ?
                      and status in ('queued', 'running', 'succeeded')
                    """, Integer.class, candidateId);
            if (exists != null && exists > 0) {
                skipped++;
                continue;
            }

            int inserted = jdbc.update("""
                    insert into analysis_jobs (batch_id, candidate_id, login_id, status)
                    select ?, c.id, ?, 'queued'
                    from candidates c
                    where c.id = ? and c.login_id = ?
                    on conflict do nothing
                    """, batchId, loginId, candidateId, loginId);
            if (inserted > 0) queued++;
            else skipped++;
        }

        return getBatchStatus(batchId, loginId, skipped);
    }

    public AnalysisJobBatchResponse getBatchStatus(String batchId, String loginId) {
        return getBatchStatus(batchId, loginId, 0);
    }

    private AnalysisJobBatchResponse getBatchStatus(String batchId, String loginId, int skipped) {
        List<String> statuses = jdbc.query("""
                select status from analysis_jobs
                where batch_id = ? and login_id = ?
                """, (rs, rowNum) -> rs.getString("status"), batchId, loginId);

        int queued = count(statuses, "queued");
        int running = count(statuses, "running");
        int succeeded = count(statuses, "succeeded");
        int failed = count(statuses, "failed");
        return new AnalysisJobBatchResponse(batchId, queued, running, succeeded, failed, skipped, statuses.size() + skipped);
    }

    @Scheduled(fixedDelayString = "${analysis-jobs.worker-delay-ms:5000}")
    public void processQueuedJobs() {
        if (!workerRunning.compareAndSet(false, true)) return;
        try {
            List<Long> jobIds = jdbc.query("""
                    select id from analysis_jobs
                    where status = 'queued'
                      and next_run_at <= now()
                    order by created_at asc
                    limit ?
                    """, (rs, rowNum) -> rs.getLong("id"), maxParallelJobs);

            jobIds.parallelStream().forEach(this::processJob);
        } finally {
            workerRunning.set(false);
        }
    }

    private void processJob(Long jobId) {
        List<AnalysisJobRow> rows = jdbc.query("""
                update analysis_jobs
                set status = 'running',
                    started_at = now(),
                    updated_at = now()
                where id = ? and status = 'queued'
                returning id, candidate_id, login_id, attempts
                """, (rs, rowNum) -> new AnalysisJobRow(
                rs.getLong("id"),
                rs.getString("candidate_id"),
                rs.getString("login_id"),
                rs.getInt("attempts")), jobId);

        if (rows.isEmpty()) return;

        AnalysisJobRow job = rows.get(0);
        try {
            CandidateAnalysisResponse existing = analysisService.getAIAnalysisForCandidate(job.candidateId());
            if (existing == null) {
                CandidateResponse candidate = analysisService.getJobIdNameForCandidate(job.candidateId());
                analysisService.analyze(job.candidateId(), candidate, job.loginId());
            }
            jdbc.update("""
                    update analysis_jobs
                    set status = 'succeeded',
                        finished_at = now(),
                        updated_at = now(),
                        error_message = null
                    where id = ?
                    """, job.id());
        } catch (Exception e) {
            int nextAttempts = job.attempts() + 1;
            boolean failed = nextAttempts >= maxAttempts;
            OffsetDateTime nextRunAt = OffsetDateTime.now().plusSeconds((long) Math.pow(2, nextAttempts) * 30);
            jdbc.update("""
                    update analysis_jobs
                    set status = ?,
                        attempts = ?,
                        error_message = ?,
                        next_run_at = ?,
                        finished_at = case when ? then now() else finished_at end,
                        updated_at = now()
                    where id = ?
                    """,
                    failed ? "failed" : "queued",
                    nextAttempts,
                    trimError(e),
                    nextRunAt,
                    failed,
                    job.id());
        }
    }

    private static int count(List<String> statuses, String status) {
        return (int) statuses.stream().filter(status::equals).count();
    }

    private static String trimError(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) message = e.getClass().getSimpleName();
        return message.length() <= 1000 ? message : message.substring(0, 1000);
    }

    private record AnalysisJobRow(Long id, String candidateId, String loginId, int attempts) {}
}
