package com.nolyvra.app.service;

import com.nolyvra.app.model.CoWorkerChatRequest;
import com.nolyvra.app.model.CoWorkerChatResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@ConditionalOnProperty(name = "nolyvra.mock-ai", havingValue = "true")
public class MockCoWorkerAiClient implements CoWorkerAiClient {

    private final JdbcTemplate jdbc;

    public MockCoWorkerAiClient(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public CoWorkerChatResponse chat(
            String loginId,
            Long sessionId,
            String message,
            String context,
            List<CoWorkerChatRequest.ChatMessage> history) {
        String lower = message == null ? "" : message.toLowerCase(Locale.ROOT);
        if (lower.contains("create") && (lower.contains("job") || lower.contains("role") || lower.contains("vacancy"))) {
            return createJobResponse(sessionId);
        }
        if (lower.contains("attached cvs:") || lower.contains("attached cv:")) {
            return addCandidateResponse(loginId, sessionId, message);
        }
        return new CoWorkerChatResponse(
                sessionId,
                "Mock Co-worker is running locally. Ask me to create a job or attach a CV to test actions.",
                null);
    }

    private CoWorkerChatResponse createJobResponse(Long sessionId) {
        Map<String, Object> actionParams = new LinkedHashMap<>();
        actionParams.put("title", "Senior Backend Engineer");
        actionParams.put("company", "Acme FinTech");
        actionParams.put("jobType", "Full-time");
        actionParams.put("seniority", "Senior · 5+ yrs");
        actionParams.put("jdText", """
                We are hiring a Senior Backend Engineer to design, build, and operate reliable backend services for a growing fintech platform.

                Responsibilities:
                - Build scalable Java and Spring Boot services.
                - Design REST APIs, data models, and distributed system components.
                - Collaborate with product, frontend, and platform teams.
                - Improve reliability, observability, and deployment practices.

                Requirements:
                - 5+ years of backend engineering experience.
                - Strong Java, Spring Boot, PostgreSQL, AWS, and microservices experience.
                - Comfortable with Docker, Kubernetes, system design, and production operations.
                - Clear communication and strong ownership.
                """);
        actionParams.put("location", "Melbourne");
        actionParams.put("stackTags", List.of(
                "Java", "Spring Boot", "PostgreSQL", "AWS", "Microservices", "REST APIs", "Docker", "Kubernetes"));
        actionParams.put("jobStatus", "Active");
        actionParams.put("salary", 160000);
        actionParams.put("currency", "AUD");
        actionParams.put("feePercentage", 18);

        return new CoWorkerChatResponse(
                sessionId,
                "I found a create-job request. I can create a Senior Backend Engineer job for Acme FinTech with the key skills and fee details.",
                new CoWorkerChatResponse.PendingAction(
                        "CREATE_JOB",
                        "Create Senior Backend Engineer at Acme FinTech.",
                        actionParams));
    }

    private CoWorkerChatResponse addCandidateResponse(String loginId, Long sessionId, String message) {
        Map<String, Object> candidate = new LinkedHashMap<>();
        candidate.put("name", extractAttachedField(message, "name", "Attached Candidate"));
        candidate.put("email", extractAttachedField(message, "email", ""));
        candidate.put("phone", extractAttachedField(message, "phone", ""));
        candidate.put("linkedinUrl", extractAttachedField(message, "linkedinUrl", ""));
        candidate.put("skills", listFromCommaText(extractAttachedField(message, "skills", "")));
        candidate.put("cvText", extractAttachedField(message, "cvText", message));

        Map<String, String> job = latestJob(loginId);
        Map<String, Object> actionParams = new LinkedHashMap<>();
        actionParams.put("jobId", job.get("id"));
        actionParams.put("jobTitle", job.get("title"));
        actionParams.put("candidates", List.of(candidate));

        String reply = "I found 1 attached CV. I can add it"
                + (job.get("title") != null ? " to " + job.get("title") : " as an unassigned candidate")
                + ".";

        return new CoWorkerChatResponse(
                sessionId,
                reply,
                new CoWorkerChatResponse.PendingAction(
                        "ADD_CANDIDATES",
                        job.get("title") != null
                                ? "Add attached CV to " + job.get("title") + "."
                                : "Add attached CV as a candidate.",
                        actionParams));
    }

    private Map<String, String> latestJob(String loginId) {
        try {
            return jdbc.query("""
                    select id, title from jobs
                    where login_id = ? and is_active = true
                    order by created_at desc limit 1
                    """, (rs, r) -> {
                Map<String, String> job = new LinkedHashMap<>();
                job.put("id", rs.getString("id"));
                job.put("title", rs.getString("title"));
                return job;
            }, loginId).stream().findFirst().orElseGet(MockCoWorkerAiClient::emptyJob);
        } catch (Exception e) {
            return emptyJob();
        }
    }

    private static Map<String, String> emptyJob() {
        Map<String, String> empty = new LinkedHashMap<>();
        empty.put("id", null);
        empty.put("title", null);
        return empty;
    }

    private static String extractAttachedField(String text, String field, String fallback) {
        if (text == null || text.isBlank()) return fallback;
        String marker = field + ":";
        int start = text.indexOf(marker);
        if (start < 0) return fallback;
        start += marker.length();
        int next = text.length();
        for (String candidateMarker : List.of(
                "\nfileName:", "\nname:", "\nemail:", "\nphone:", "\nlinkedinUrl:", "\nskills:", "\ncvText:", "\n\nCV ")) {
            int idx = text.indexOf(candidateMarker, start);
            if (idx >= 0 && idx < next) next = idx;
        }
        String value = text.substring(start, next).trim();
        return value.isBlank() ? fallback : value;
    }

    private static List<String> listFromCommaText(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }
}
