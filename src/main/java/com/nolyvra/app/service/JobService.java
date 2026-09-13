package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientBriefRequest;
import com.nolyvra.app.model.ClientBriefResponse;
import com.nolyvra.app.model.JobCreateRequest;
import com.nolyvra.app.model.JobResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class JobService {

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;
    private final TokenService tokenService;

    public JobService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.jdbc = jdbc;
        this.openAI = openAIClient;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.model = model;
    }

    // ─── Row mapper ───────────────────────────────────────────────────────────

    private static final RowMapper<JobResponse> JOB_MAPPER = (rs, rowNum) -> {
        OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
        BigDecimal salary = rs.getBigDecimal("salary");
        BigDecimal feePercentage = rs.getBigDecimal("fee_percentage");
        String feeType = rs.getString("fee_type");
        BigDecimal fixedFee = rs.getBigDecimal("fixed_fee");
        return new JobResponse(
                rs.getString("id"),
                rs.getString("title"),
                rs.getString("company"),
                rs.getString("job_type"),
                null,
                rs.getString("jd_text"),
                rs.getString("location"),
                List.of(),
                created != null ? created.toInstant() : null,
                rs.getString("status"),
                salary,
                rs.getString("currency"),
                feePercentage,
                feeType,
                fixedFee,
                computeEstimatedFee(salary, feePercentage, feeType, fixedFee),
                optionalInt(rs, "candidate_count"),
                optionalInt(rs, "avg_capability_score"));
    };

    // getJob()'s plain query has neither column (no aggregate join there — a
    // single-job fetch has no need for it); listJobs()'s aggregate query
    // always supplies candidate_count (coalesced to 0) and avg_capability_score.
    private static Integer optionalInt(ResultSet rs, String column) {
        try {
            Object value = rs.getObject(column);
            return value != null ? ((Number) value).intValue() : null;
        } catch (SQLException e) {
            return null;
        }
    }

    // ─── Estimated fee — FIXED: the flat fee as-is. PERCENTAGE (default,
    // including pre-existing jobs with no fee_type set): salary * fee% / 100.
    // Never stored — always derived. ──────────────────────────────────────────

    private static BigDecimal computeEstimatedFee(
            BigDecimal salary, BigDecimal feePercentage, String feeType, BigDecimal fixedFee) {
        if ("FIXED".equals(feeType)) return fixedFee;
        if (salary == null || feePercentage == null) return null;
        return salary.multiply(feePercentage)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    public JobResponse createJob(JobCreateRequest req, String loginId) {
        String id = "job-" + UUID.randomUUID();
        String feeType = req.feeType() != null ? req.feeType() : "PERCENTAGE";
        jdbc.update("""
                insert into jobs
                    (id, title, company, job_type, jd_text, location, login_id, status, is_active,
                     salary, currency, fee_percentage, fee_type, fixed_fee)
                values (?, ?, ?, ?, ?, ?, ?, 'Active', true, ?, ?, ?, ?, ?)
                """,
                id, req.title(), req.company(), req.jobType(),
                req.jdText(), req.location(), loginId,
                req.salary(), req.currency(), req.feePercentage(), feeType, req.fixedFee());

        autoCreateClientIfNew(req.company(), req.location(), loginId);

        return new JobResponse(
                id, req.title(), req.company(), req.jobType(),
                req.seniority(), req.jdText(), req.location(),
                req.stackTags() != null ? req.stackTags() : List.of(),
                Instant.now(), req.jobStatus(),
                req.salary(), req.currency(), req.feePercentage(), feeType, req.fixedFee(),
                computeEstimatedFee(req.salary(), req.feePercentage(), feeType, req.fixedFee()),
                0, null);
    }

    // ─── List ─────────────────────────────────────────────────────────────────
    // candidate_count/avg_capability_score are computed here (not fetched
    // per-job by the frontend) specifically so JobsPage can page the jobs
    // list without an N+1 candidates+analysis fetch per job just to render
    // those two table columns.

    public List<JobResponse> listJobs(String loginId) {
        return listJobs(loginId, null, null);
    }

    public List<JobResponse> listJobs(String loginId, Integer limit, Integer offset) {
        boolean paginated = limit != null;
        String sql = """
                select j.id, j.title, j.company, j.job_type, j.jd_text, j.created_at, j.location, j.status,
                       j.salary, j.currency, j.fee_percentage, j.fee_type, j.fixed_fee,
                       coalesce(stats.candidate_count, 0) as candidate_count,
                       stats.avg_capability_score
                from jobs j
                left join (
                    select ja.job_id,
                           count(distinct ja.candidate_id) as candidate_count,
                           avg(latest.capability_score) as avg_capability_score
                    from job_applications ja
                    left join lateral (
                        select a.capability_score
                        from analyses a
                        where a.candidate_id = ja.candidate_id and a.job_id = ja.job_id
                        order by a.analyzed_at desc
                        limit 1
                    ) latest on true
                    where ja.is_active = true
                    group by ja.job_id
                ) stats on stats.job_id = j.id
                where j.login_id = ? and j.is_active = true
                order by j.created_at desc
                """
                + (paginated ? "limit ? offset ?" : "");

        List<Object> params = new ArrayList<>();
        params.add(loginId);
        if (paginated) {
            params.add(limit);
            params.add(offset != null ? offset : 0);
        }
        return jdbc.query(sql, JOB_MAPPER, params.toArray());
    }

    // ─── Get single ───────────────────────────────────────────────────────────

    public Optional<JobResponse> getJob(String jobId, String loginId) {
        return jdbc.query("""
                select id, title, company, job_type, jd_text, created_at, location, status,
                       salary, currency, fee_percentage, fee_type, fixed_fee
                from jobs
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, JOB_MAPPER, jobId, loginId).stream().findFirst();
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public Optional<JobResponse> updateJob(String jobId, JobCreateRequest req, String loginId) {
        String feeType = req.feeType() != null ? req.feeType() : "PERCENTAGE";
        int updated = jdbc.update("""
                update jobs
                set title = ?, company = ?, job_type = ?, jd_text = ?,
                    location = ?, status = ?, salary = ?, currency = ?, fee_percentage = ?,
                    fee_type = ?, fixed_fee = ?,
                    updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """,
                req.title(), req.company(), req.jobType(), req.jdText(),
                req.location(), req.jobStatus() != null ? req.jobStatus() : "Fulfilling",
                req.salary(), req.currency(), req.feePercentage(), feeType, req.fixedFee(),
                jobId, loginId);
        if (updated == 0)
            return Optional.empty();
        autoCreateClientIfNew(req.company(), req.location(), loginId);
        return getJob(jobId, loginId);
    }

    // ─── Auto-create client entry when a new company is introduced via a job ──

    private void autoCreateClientIfNew(String company, String location, String loginId) {
        if (company == null || company.isBlank()) return;
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clients WHERE login_id = ? AND lower(company_name) = lower(?)",
                Integer.class, loginId, company);
        if (count == null || count == 0) {
            jdbc.update(
                    "INSERT INTO clients (login_id, company_name, location) VALUES (?, ?, ?)",
                    loginId, company, location);
        }
    }

    // ─── Soft delete ──────────────────────────────────────────────────────────
    // Sets is_active = false instead of physically deleting.
    // All candidates and analyses linked to this job are preserved for audit.

    public boolean deleteJob(String jobId, String loginId) {
        int rows = jdbc.update("""
                update jobs
                set is_active = false,
                    updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, jobId, loginId);
        return rows > 0;
    }

    // ─── AI Client Brief Analyzer ─────────────────────────────────────────────

    public ClientBriefResponse analyzeClientBrief(ClientBriefRequest req, String loginId) {

        if (!tokenService.deductToken(loginId))
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");

        String systemPrompt = """
                You are a senior recruitment consultant who specialises in writing structured job descriptions.
                Return EXACTLY ONE JSON object — no markdown, no extra keys:

                {
                  "seniorityLevel": "e.g. Senior · 5+ yrs",
                  "roleType": "e.g. Technical Lead | Individual Contributor | Manager",
                  "industry": "e.g. FinTech | HealthTech | E-Commerce",
                  "company": "<company or client name if mentioned in the brief, otherwise empty string>",
                  "location": "<work location or city if mentioned in the brief, otherwise empty string>",
                  "generatedJdText": "<full formal job description as a multi-line string>",
                  "extractedSkills": ["skill1", "skill2", ...],
                  "softSkills": ["skill1", "skill2", ...]
                }

                Hard rules:
                - generatedJdText must be a complete, professional job description.
                - extractedSkills: technical skills only, max 10 items.
                - softSkills: non-technical, max 6 items.
                - company: extract from brief if mentioned (e.g. company name, client name). Return "" if not found.
                - location: extract from brief if mentioned (e.g. city, country, remote). Return "" if not found.
                - All fields are required.
                """;

        String userPrompt = "CLIENT BRIEF:\n" + req.briefText();

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage(userPrompt)
                .temperature(0.3)
                .build();

        var completion = openAI.chat().completions().create(params);
        String content = completion.choices().getFirst().message().content()
                .orElseThrow(() -> new IllegalStateException("Model returned empty content"));

        try {
            String clean = content.strip();
            if (clean.startsWith("```")) {
                clean = clean.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            }
            return objectMapper.readValue(clean, ClientBriefResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse AI brief response: " + e.getMessage(), e);
        }
    }
}
