package com.depthhire.app.service;

import com.depthhire.app.model.ClientBriefRequest;
import com.depthhire.app.model.ClientBriefResponse;
import com.depthhire.app.model.JobCreateRequest;
import com.depthhire.app.model.JobResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class JobService {

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;

    public JobService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.jdbc = jdbc;
        this.openAI = openAIClient;
        this.objectMapper = objectMapper;
        this.model = model;
    }

    // ─── Row mapper ───────────────────────────────────────────────────────────

    private static final RowMapper<JobResponse> JOB_MAPPER = (rs, rowNum) -> {
        OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
        return new JobResponse(
                rs.getString("id"),
                rs.getString("title"),
                rs.getString("company"),
                rs.getString("job_type"),
                null,
                rs.getString("jd_text"),
                rs.getString("location"),
                List.of(),
                created != null ? created.toInstant() : null);
    };

    // ─── Create ───────────────────────────────────────────────────────────────

    public JobResponse createJob(JobCreateRequest req, String loginId) {
        String id = "job-" + UUID.randomUUID();
        jdbc.update("""
                insert into jobs
                    (id, title, company, job_type, jd_text, location, login_id, status, is_active)
                values (?, ?, ?, ?, ?, ?, ?, 'Active', true)
                """,
                id, req.title(), req.company(), req.jobType(),
                req.jdText(), req.location(), loginId);

        return new JobResponse(
                id, req.title(), req.company(), req.jobType(),
                req.seniority(), req.jdText(), req.location(),
                req.stackTags() != null ? req.stackTags() : List.of(),
                Instant.now());
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<JobResponse> listJobs(String loginId) {
        return jdbc.query("""
                select id, title, company, job_type, jd_text, created_at, location
                from jobs
                where login_id = ?
                  and is_active = true
                order by created_at desc
                """, JOB_MAPPER, loginId);
    }

    // ─── Get single ───────────────────────────────────────────────────────────

    public Optional<JobResponse> getJob(String jobId, String loginId) {
        return jdbc.query("""
                select id, title, company, job_type, jd_text, created_at, location
                from jobs
                where id = ?
                  and login_id = ?
                  and is_active = true
                """, JOB_MAPPER, jobId, loginId).stream().findFirst();
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public Optional<JobResponse> updateJob(String jobId, JobCreateRequest req, String loginId) {
        int updated = jdbc.update("""
                update jobs
                set title = ?, company = ?, job_type = ?, jd_text = ?,
                    location = ?, updated_at = now()
                where id = ?
                  and login_id = ?
                  and is_active = true
                """,
                req.title(), req.company(), req.jobType(), req.jdText(),
                req.location(), jobId, loginId);
        if (updated == 0)
            return Optional.empty();
        return getJob(jobId, loginId);
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

    public ClientBriefResponse analyzeClientBrief(ClientBriefRequest req) {

        String systemPrompt = """
                You are a senior recruitment consultant who specialises in writing structured job descriptions.
                Return EXACTLY ONE JSON object — no markdown, no extra keys:

                {
                  "seniorityLevel": "e.g. Senior · 5+ yrs",
                  "roleType": "e.g. Technical Lead | Individual Contributor | Manager",
                  "industry": "e.g. FinTech | HealthTech | E-Commerce",
                  "generatedJdText": "<full formal job description as a multi-line string>",
                  "extractedSkills": ["skill1", "skill2", ...],
                  "softSkills": ["skill1", "skill2", ...]
                }

                Hard rules:
                - generatedJdText must be a complete, professional job description.
                - extractedSkills: technical skills only, max 10 items.
                - softSkills: non-technical, max 6 items.
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