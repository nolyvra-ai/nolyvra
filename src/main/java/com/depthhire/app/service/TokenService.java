package com.depthhire.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class TokenService {

    private static final int TOKENS_PER_CALL = 10;

    private final JdbcTemplate jdbc;

    public TokenService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Deduct tokens for an OpenAI call ────────────────────────────────────
    // Deducts TOKENS_PER_CALL (10) from the user's balance.
    // Returns false if the user has insufficient tokens — caller should check.

    public boolean deductToken(String loginId) {
        if (loginId == null || loginId.isBlank()) return true; // skip for anonymous
        try {
            int updated = jdbc.update("""
                    update login
                    set tokens_remaining = greatest(0, tokens_remaining - ?)
                    where id = ?
                      and tokens_remaining >= ?
                    """, TOKENS_PER_CALL, loginId, TOKENS_PER_CALL);
            if (updated == 0) {
                System.out.println("[TokenService] Insufficient tokens for user: " + loginId);
                return false;
            }
            return true;
        } catch (Exception e) {
            System.err.println("[TokenService] deductToken() failed: " + e.getMessage());
            return true; // fail open — don't block the AI call on DB errors
        }
    }

    // ─── Check if user has enough tokens ─────────────────────────────────────

    public boolean hasTokens(String loginId) {
        if (loginId == null || loginId.isBlank()) return true;
        try {
            Integer remaining = jdbc.queryForObject(
                    "select tokens_remaining from login where id = ?",
                    Integer.class, loginId);
            return remaining != null && remaining >= TOKENS_PER_CALL;
        } catch (Exception e) {
            return true; // fail open
        }
    }

    // ─── Get current token balance ────────────────────────────────────────────

    public int getTokensRemaining(String loginId) {
        try {
            Integer remaining = jdbc.queryForObject(
                    "select tokens_remaining from login where id = ?",
                    Integer.class, loginId);
            return remaining != null ? remaining : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    // ─── Scheduler: renew tokens on renew_date ────────────────────────────────
    // Runs every day at midnight.
    // For each user whose renew_date is today or past, resets tokens_remaining
    // to their plan's max_tokens and sets the next renew_date to +30 days.

    @Scheduled(cron = "0 0 0 * * *")
    public void renewTokens() {
        try {
            List<String> dueUsers = jdbc.query("""
                    select l.id from login l
                    where l.renew_date <= current_date
                    """,
                    (rs, r) -> rs.getString("id"));

            int renewed = 0;
            for (String userId : dueUsers) {
                try {
                    jdbc.update("""
                            update login l
                            set tokens_remaining = p.max_tokens,
                                renew_date = current_date + INTERVAL '30 days'
                            from plans p
                            where l.plan_id = p.id
                              and l.id = ?
                            """, userId);
                    renewed++;
                } catch (Exception e) {
                    System.err.println("[TokenService] renewTokens() failed for user "
                            + userId + ": " + e.getMessage());
                }
            }
            if (renewed > 0) {
                System.out.println("[TokenService] Renewed tokens for " + renewed + " user(s).");
            }
        } catch (Exception e) {
            System.err.println("[TokenService] renewTokens() scheduler failed: " + e.getMessage());
        }
    }
}
