package com.depthhire.app.service;

import com.depthhire.app.model.PlanUsageResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PlanService {

    private final JdbcTemplate jdbc;

    public PlanService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Get plan + current usage for a user ─────────────────────────────────

    public PlanUsageResponse getPlanUsage(String loginId) {
        // Fetch plan limits for this user
        var rows = jdbc.query("""
                select p.id as plan_id, p.name as plan_name,
                       p.max_jobs, p.max_candidates
                from login l
                join plans p on p.id = l.plan_id
                where l.id = ?
                """,
                (rs, r) -> new Object[]{
                        rs.getString("plan_id"),
                        rs.getString("plan_name"),
                        rs.getInt("max_jobs"),
                        rs.getInt("max_candidates")
                }, loginId);

        if (rows.isEmpty()) {
            // Default to Free plan if user not found (shouldn't happen)
            return new PlanUsageResponse("plan-free", "Free", 7, 10,
                    currentJobCount(loginId), currentCandidateCount(loginId));
        }

        Object[] row = rows.get(0);
        return new PlanUsageResponse(
                (String)  row[0],
                (String)  row[1],
                (Integer) row[2],
                (Integer) row[3],
                currentJobCount(loginId),
                currentCandidateCount(loginId));
    }

    // ─── Limit checks (called from Job/Candidate controllers) ────────────────

    public boolean isJobLimitReached(String loginId) {
        PlanUsageResponse usage = getPlanUsage(loginId);
        return usage.currentJobs() >= usage.maxJobs();
    }

    public boolean isCandidateLimitReached(String loginId) {
        PlanUsageResponse usage = getPlanUsage(loginId);
        return usage.currentCandidates() >= usage.maxCandidates();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    // Count only active (non-soft-deleted) jobs
    private int currentJobCount(String loginId) {
        Integer count = jdbc.queryForObject(
                "select count(*) from jobs where login_id = ? and is_active = true",
                Integer.class, loginId);
        return count != null ? count : 0;
    }

    // Count only active (non-soft-deleted) candidates
    private int currentCandidateCount(String loginId) {
        Integer count = jdbc.queryForObject(
                "select count(*) from candidates where login_id = ? and is_active = true",
                Integer.class, loginId);
        return count != null ? count : 0;
    }
}
