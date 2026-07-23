package com.nolyvra.app.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

// ============================================================================
// TEMPORARY — added 2026-07-23, Candidate <-> Job Application migration
// (V56__job_applications.sql / CandidateMergeMigrationService).
//
// ~30 production tenants can't each be asked to manually call
// POST /api/auth/admin/migrate-applications, so this runs that same
// per-tenant backfill for every tenant automatically on every app startup.
// CandidateMergeMigrationService.migrateTenant(...) is idempotent — it skips
// any tenant that already has job_applications rows — so this is safe to run
// repeatedly and does nothing once every tenant has been backfilled once.
//
// REMOVE THIS FILE once all production tenants are confirmed backfilled
// (check the startup logs for "[StartupMigration]" — every tenant should log
// status=skipped). Sayan asked to be reminded of this within a few days of
// 2026-07-23 — see MEMORY.md entry "startup-candidate-migration-cleanup".
// ============================================================================
@Component
public class CandidateMergeStartupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CandidateMergeStartupRunner.class);

    private final JdbcTemplate jdbc;
    private final CandidateMergeMigrationService migrationService;

    public CandidateMergeStartupRunner(JdbcTemplate jdbc, CandidateMergeMigrationService migrationService) {
        this.jdbc = jdbc;
        this.migrationService = migrationService;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> tenantIds = jdbc.queryForList("select id from login", String.class);
        log.info("[StartupMigration] Candidate<->JobApplication backfill starting for {} tenant(s)", tenantIds.size());

        int migrated = 0, skipped = 0, failed = 0;
        for (String loginId : tenantIds) {
            try {
                Map<String, Object> result = migrationService.migrateTenant(loginId);
                if ("skipped".equals(result.get("status"))) {
                    skipped++;
                } else {
                    migrated++;
                    log.info("[StartupMigration] loginId={} result={}", loginId, result);
                }
            } catch (Exception e) {
                failed++;
                log.error("[StartupMigration] loginId={} failed: {}", loginId, e.getMessage(), e);
            }
        }
        log.info("[StartupMigration] Done. migrated={} skipped={} failed={} of {} tenant(s)",
                migrated, skipped, failed, tenantIds.size());
    }
}
