package com.nolyvra.app.service;

import com.nolyvra.app.model.LoginRequest;
import com.nolyvra.app.model.LoginResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class LoginService {

    private final JdbcTemplate jdbc;

    public LoginService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<LoginResponse> LOGIN_MAPPER = (rs, rowNum) -> {
        OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
        return new LoginResponse(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("company"),
                rs.getString("email"),
                created != null ? created.toInstant() : null,
                rs.getInt("monthly_target")
        );
    };

    public Optional<LoginResponse> login(LoginRequest req) {
        List<LoginResponse> rows = jdbc.query("""
                select id, name, company, email, created_at, monthly_target
                from login
                where email = ?
                  and password_hash = ?
                """,
                LOGIN_MAPPER,
                req.email(),
                req.passwordHash()
        );

        return rows.stream().findFirst();
    }

    public int getMonthlyTarget(String loginId) {
        List<Integer> rows = jdbc.query(
                "select monthly_target from login where id = ?",
                (rs, r) -> rs.getInt("monthly_target"),
                loginId);
        return rows.isEmpty() ? 35 : rows.get(0);
    }

    public void saveMonthlyTarget(String loginId, int target) {
        jdbc.update("update login set monthly_target = ? where id = ?", target, loginId);
    }

    public int getFulfilledThisMonth(String loginId) {
        List<Integer> rows = jdbc.query("""
                select count(*) from candidates
                where login_id = ?
                  and stage = 'Selected'
                  and updated_at >= date_trunc('month', now())
                """,
                (rs, r) -> rs.getInt(1),
                loginId);
        return rows.isEmpty() ? 0 : rows.get(0);
    }

    // ── Dashboard Insights ────────────────────────────────────────────────────

    private static final List<String> SKILL_LIST = List.of(
            "React", "Angular", "Vue", "Node.js", "Python",
            "Java", "TypeScript", "JavaScript", "AWS", "Azure",
            "Docker", "Kubernetes", "SQL", "MongoDB", "Agile",
            "Leadership", "REST", "GraphQL", "Spring", "Django"
    );

    public Map<String, Object> getDashboardInsights(String loginId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hiringInsights", buildHiringInsights(loginId));
        result.put("skillGap",       buildSkillGap(loginId));
        result.put("bottlenecks",    buildBottlenecks(loginId));
        result.put("profileSource",  buildProfileSourceQuality(loginId));
        result.put("pipelineHealth", buildPipelineHealth(loginId));
        return result;
    }

    private Map<String, Object> buildHiringInsights(String loginId) {
        Map<String, Object> row = jdbc.queryForObject("""
                SELECT
                  COUNT(*)                                                          AS total,
                  COUNT(*) FILTER (WHERE stage = 'Screening'  AND is_active = true) AS screening,
                  COUNT(*) FILTER (WHERE stage = 'Interview'  AND is_active = true) AS interview,
                  COUNT(*) FILTER (WHERE stage = 'Assessment' AND is_active = true) AS assessment,
                  COUNT(*) FILTER (WHERE stage = 'Offer'      AND is_active = true) AS offered,
                  COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now()))   AS this_week,
                  COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now()) - INTERVAL '7 days'
                                   AND   created_at <  date_trunc('week', now()))   AS last_week
                FROM candidates WHERE login_id = ? AND is_active = true
                """,
                (rs, r) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("total",      rs.getInt("total"));
                    m.put("screening",  rs.getInt("screening"));
                    m.put("interview",  rs.getInt("interview"));
                    m.put("assessment", rs.getInt("assessment"));
                    m.put("offered",    rs.getInt("offered"));
                    m.put("thisWeek",   rs.getInt("this_week"));
                    m.put("lastWeek",   rs.getInt("last_week"));
                    return m;
                },
                loginId);

        int total = row != null ? (int) row.get("total") : 0;

        List<Map<String, Object>> stages = new ArrayList<>();
        for (String[] entry : new String[][]{
                {"Screening",  "screening"},
                {"Interview",  "interview"},
                {"Assessment", "assessment"},
                {"Offered",    "offered"}
        }) {
            int count = row != null ? (int) row.get(entry[1]) : 0;
            int pct   = total > 0 ? (int) (count * 100L / total) : 0;
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("label", entry[0]);
            s.put("count", count);
            s.put("pct",   pct);
            stages.add(s);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalCandidates", total);
        out.put("stages",          stages);
        out.put("thisWeekCount",   row != null ? row.get("thisWeek") : 0);
        out.put("lastWeekCount",   row != null ? row.get("lastWeek") : 0);
        return out;
    }

    private List<Map<String, Object>> buildSkillGap(String loginId) {
        List<String> jobTexts = jdbc.query(
                "SELECT LOWER(jd_text) FROM jobs WHERE login_id = ? AND is_active = true AND jd_text IS NOT NULL",
                (rs, r) -> rs.getString(1), loginId);

        List<String> cvTexts = jdbc.query(
                "SELECT LOWER(cv_text) FROM candidates WHERE login_id = ? AND is_active = true AND cv_text IS NOT NULL",
                (rs, r) -> rs.getString(1), loginId);

        if (jobTexts.isEmpty() && cvTexts.isEmpty()) return List.of();

        List<Map<String, Object>> result = new ArrayList<>();
        for (String skill : SKILL_LIST) {
            String key      = skill.toLowerCase();
            long jobCount   = jobTexts.stream().filter(t -> t.contains(key)).count();
            long cvCount    = cvTexts.stream().filter(t -> t.contains(key)).count();
            if (jobCount == 0 && cvCount == 0) continue;
            int reqPct  = jobTexts.isEmpty() ? 0 : (int) (jobCount * 100 / jobTexts.size());
            int poolPct = cvTexts.isEmpty()  ? 0 : (int) (cvCount  * 100 / cvTexts.size());
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("skill",       skill);
            entry.put("requiredPct", reqPct);
            entry.put("poolPct",     poolPct);
            result.add(entry);
        }
        result.sort((a, b) -> (Integer) b.get("requiredPct") - (Integer) a.get("requiredPct"));
        return result.stream().limit(6).collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildBottlenecks(String loginId) {
        return jdbc.query("""
                SELECT
                  j.title AS job_title,
                  c.stage,
                  CAST(MAX(EXTRACT(EPOCH FROM (now() - c.updated_at)) / 86400) AS INTEGER) AS days_in_stage
                FROM candidates c
                JOIN jobs j ON c.job_id = j.id
                WHERE c.login_id = ?
                  AND c.is_active = true
                  AND c.stage NOT IN ('Selected', 'Rejected')
                  AND c.job_id IS NOT NULL
                GROUP BY j.id, j.title, c.stage
                HAVING MAX(EXTRACT(EPOCH FROM (now() - c.updated_at)) / 86400) >= 1
                ORDER BY days_in_stage DESC
                LIMIT 5
                """,
                (rs, r) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("jobTitle",    rs.getString("job_title"));
                    m.put("stage",       rs.getString("stage"));
                    m.put("daysInStage", rs.getInt("days_in_stage"));
                    return m;
                },
                loginId);
    }

    private List<Map<String, Object>> buildProfileSourceQuality(String loginId) {
        return jdbc.query("""
                SELECT
                  CASE WHEN c.cv_text IS NOT NULL THEN 'Direct Apply' ELSE 'CoreSignal' END AS source,
                  COUNT(DISTINCT c.id)                                                        AS total_count,
                  COALESCE(ROUND(AVG(a.capability_score))::INTEGER, 0)                        AS avg_score,
                  COUNT(DISTINCT CASE WHEN a.capability_score >= 80 THEN c.id END)            AS top_picks_count
                FROM candidates c
                LEFT JOIN (
                  SELECT DISTINCT ON (candidate_id) candidate_id, capability_score
                  FROM analyses
                  ORDER BY candidate_id, analyzed_at DESC
                ) a ON a.candidate_id = c.id
                WHERE c.login_id = ? AND c.is_active = true
                GROUP BY CASE WHEN c.cv_text IS NOT NULL THEN 'Direct Apply' ELSE 'CoreSignal' END
                ORDER BY source
                """,
                (rs, r) -> {
                    int count    = rs.getInt("total_count");
                    int topPicks = rs.getInt("top_picks_count");
                    int avgScore = rs.getInt("avg_score");
                    int topPct   = count > 0 ? (int) (topPicks * 100L / count) : 0;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("source",      rs.getString("source"));
                    m.put("count",       count);
                    m.put("avgScore",    avgScore);
                    m.put("topPicksPct", topPct);
                    return m;
                },
                loginId);
    }

    private Map<String, Object> buildPipelineHealth(String loginId) {
        Map<String, Object> row = jdbc.queryForObject("""
                SELECT
                  COUNT(*)                                                                            AS applications,
                  COUNT(*) FILTER (WHERE stage NOT IN ('Rejected'))                                  AS screening,
                  COUNT(*) FILTER (WHERE stage IN ('Interview', 'Assessment', 'Offer', 'Selected'))  AS interview,
                  COUNT(*) FILTER (WHERE stage IN ('Assessment', 'Offer', 'Selected'))               AS assessment,
                  COUNT(*) FILTER (WHERE stage IN ('Offer', 'Selected'))                             AS offer_stage,
                  COUNT(*) FILTER (WHERE stage = 'Selected')                                         AS selected_count
                FROM candidates WHERE login_id = ?
                """,
                (rs, r) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("applications", rs.getInt("applications"));
                    m.put("screening",    rs.getInt("screening"));
                    m.put("interview",    rs.getInt("interview"));
                    m.put("assessment",   rs.getInt("assessment"));
                    m.put("offer",        rs.getInt("offer_stage"));
                    m.put("selected",     rs.getInt("selected_count"));
                    return m;
                },
                loginId);

        if (row == null) return new LinkedHashMap<>();

        int[] counts = {
            (int) row.get("applications"),
            (int) row.get("screening"),
            (int) row.get("interview"),
            (int) row.get("assessment"),
            (int) row.get("offer"),
            (int) row.get("selected")
        };
        String[] labels = { "Applications", "Screening", "Interview", "Assessment", "Offer", "Selected" };

        List<Map<String, Object>> stages = new ArrayList<>();
        for (int i = 0; i < labels.length; i++) {
            int dropOffPct = (i > 0 && counts[i - 1] > 0)
                ? (int) ((counts[i - 1] - counts[i]) * 100L / counts[i - 1])
                : 0;
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("name",       labels[i]);
            s.put("count",      counts[i]);
            s.put("dropOffPct", i > 0 ? dropOffPct : 0);
            stages.add(s);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stages", stages);
        result.put("total",  counts[0]);
        return result;
    }

    public boolean changePassword(String loginId, String currentPassword, String newPassword) {
    // Verify current password matches what's stored
    List<String> rows = jdbc.query(
            "select id from logins where id = ? and password = ?",
            (rs, r) -> rs.getString("id"),
            loginId, currentPassword);

    if (rows.isEmpty()) {
        return false; // current password is wrong
    }

    // Update to new password
    jdbc.update(
            "update logins set password = ? where id = ?",
            newPassword, loginId);

    return true;
}
}