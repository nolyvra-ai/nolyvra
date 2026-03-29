package com.nolyvra.app.service;

import com.nolyvra.app.model.PlanUsageResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class PlanService {

    private final JdbcTemplate jdbc;

    public PlanService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Get plan + current usage + token info for a user ────────────────────
    // Change: include additional_jobs, additional_candidates, additional_tokens
    // from login table and add them to the plan limits before returning.

    public PlanUsageResponse getPlanUsage(String loginId) {
        var rows = jdbc.query("""
                select p.id as plan_id, p.name as plan_name,
                       p.max_jobs, p.max_candidates, p.max_tokens,
                       l.tokens_remaining, l.renew_date,
                       coalesce(l.additional_jobs, 0)       as additional_jobs,
                       coalesce(l.additional_candidates, 0) as additional_candidates,
                       coalesce(l.additional_tokens, 0)     as additional_tokens
                from login l
                join plans p on p.id = l.plan_id
                where l.id = ?
                """,
                (rs, r) -> new Object[]{
                        rs.getString("plan_id"),
                        rs.getString("plan_name"),
                        rs.getInt("max_jobs"),
                        rs.getInt("max_candidates"),
                        rs.getInt("max_tokens"),
                        rs.getInt("tokens_remaining"),
                        rs.getObject("renew_date", LocalDate.class),
                        rs.getInt("additional_jobs"),
                        rs.getInt("additional_candidates"),
                        rs.getInt("additional_tokens")
                }, loginId);

        if (rows.isEmpty()) {
            return new PlanUsageResponse("plan-free", "Free", 7, 10,
                    currentJobCount(loginId), currentCandidateCount(loginId),
                    100, 100, LocalDate.now().plusDays(30));
        }

        Object[] row = rows.get(0);
        int planMaxJobs        = (Integer) row[2];
        int planMaxCandidates  = (Integer) row[3];
        int planMaxTokens      = (Integer) row[4];
        int additionalJobs     = (Integer) row[7];
        int additionalCandidates = (Integer) row[8];
        int additionalTokens   = (Integer) row[9];

        return new PlanUsageResponse(
                (String)    row[0],
                (String)    row[1],
                planMaxJobs       + additionalJobs,       // effective max
                planMaxCandidates + additionalCandidates, // effective max
                currentJobCount(loginId),
                currentCandidateCount(loginId),
                planMaxTokens     + additionalTokens,     // effective max
                (Integer)   row[5],
                (LocalDate) row[6]);
    }

    // ─── Limit checks ─────────────────────────────────────────────────────────

    public boolean isJobLimitReached(String loginId) {
        PlanUsageResponse usage = getPlanUsage(loginId);
        return usage.currentJobs() >= usage.maxJobs();
    }

    public boolean isCandidateLimitReached(String loginId) {
        PlanUsageResponse usage = getPlanUsage(loginId);
        return usage.currentCandidates() >= usage.maxCandidates();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private int currentJobCount(String loginId) {
        Integer count = jdbc.queryForObject(
                "select count(*) from jobs where login_id = ? and is_active = true",
                Integer.class, loginId);
        return count != null ? count : 0;
    }

    private int currentCandidateCount(String loginId) {
        Integer count = jdbc.queryForObject(
                "select count(*) from candidates where login_id = ? and is_active = true",
                Integer.class, loginId);
        return count != null ? count : 0;
    }
}