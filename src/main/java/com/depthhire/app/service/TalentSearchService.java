package com.depthhire.app.service;

import com.depthhire.app.model.TalentSearchRequest;
import com.depthhire.app.model.TalentSearchResponse;
import com.depthhire.app.model.TalentSearchResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TalentSearchService {

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final String model;
    private final String coreSignalApiKey;
    private final String coreSignalBaseUrl;

    public TalentSearchService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${coresignal.api-key:}") String coreSignalApiKey,
            @Value("${coresignal.base-url:https://api.coresignal.com/cdapi/v1}") String coreSignalBaseUrl) {
        this.jdbc             = jdbc;
        this.openAI           = openAIClient;
        this.objectMapper     = objectMapper;
        this.restTemplate     = new RestTemplate();
        this.model            = model;
        this.coreSignalApiKey = coreSignalApiKey;
        this.coreSignalBaseUrl = coreSignalBaseUrl;
    }

    // ─── POST /api/talent-search/query ───────────────────────────────────────

    public TalentSearchResponse search(TalentSearchRequest req, String loginId) {

        // Step 1: Use AI to extract structured filters from the natural language query
        SearchFilters filters = extractFilters(req.query());

        // Step 2: Search internal DB candidates
        List<TalentSearchResult> internalResults = searchInternal(filters, loginId);

        // Step 3: Search CoreSignal (if API key configured)
        List<TalentSearchResult> externalResults = coreSignalApiKey != null && !coreSignalApiKey.isBlank()
                ? searchCoreSignal(filters, loginId)
                : List.of();

        // Step 4: Score and merge
        List<TalentSearchResult> all = new ArrayList<>();
        all.addAll(internalResults);
        all.addAll(externalResults);

        // Sort by matchScore desc
        all.sort(Comparator.comparingInt(TalentSearchResult::matchScore).reversed());

        // Paginate
        int page     = req.page()     != null ? req.page()     : 0;
        int pageSize = req.pageSize() != null ? req.pageSize() : 9;
        int from = page * pageSize;
        int to   = Math.min(from + pageSize, all.size());
        List<TalentSearchResult> paged = from < all.size() ? all.subList(from, to) : List.of();

        return new TalentSearchResponse(
                req.query(),
                all.size(),
                internalResults.size(),
                externalResults.size(),
                paged);
    }

    // ─── Step 1: AI extracts structured filters ───────────────────────────────

    private SearchFilters extractFilters(String query) {
        String systemPrompt = """
                You are a recruitment search parser.
                Extract structured filters from the user's natural language talent search query.
                Return EXACTLY ONE JSON object — no markdown:

                {
                  "skills": ["skill1", "skill2"],
                  "seniority": "Junior|Mid|Senior|Principal|null",
                  "industry": "FinTech|HealthTech|E-Commerce|null",
                  "minYearsExperience": 0,
                  "keywords": ["keyword1"]
                }
                """;

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage("QUERY: " + query)
                .temperature(0.1)
                .build();

        try {
            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content()
                    .orElse("{}");
            String clean = content.strip()
                    .replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            return objectMapper.readValue(clean, SearchFilters.class);
        } catch (Exception e) {
            return new SearchFilters(List.of(), null, null, 0, List.of());
        }
    }

    // ─── Step 2: Internal DB search ───────────────────────────────────────────

    private List<TalentSearchResult> searchInternal(SearchFilters filters, String loginId) {

        // Get all candidates for this login with their latest analysis
        return jdbc.query("""
                select c.id, c.name, c.linkedin_url, c.cv_text, c.job_id,
                       j.title as job_title, j.company,
                       a.capability_score, a.risk_level
                from candidates c
                join jobs j on j.id = c.job_id
                left join lateral (
                    select capability_score, risk_level
                    from analyses
                    where candidate_id = c.id
                    order by analyzed_at desc limit 1
                ) a on true
                where c.login_id = ?
                """,
                (rs, rowNum) -> {
                    String cvText = rs.getString("cv_text");
                    int score = scoreCandidate(cvText, filters,
                            rs.getObject("capability_score") != null ? rs.getInt("capability_score") : 50);

                    List<String> matched = extractMatchedSkills(cvText, filters.skills());
                    List<String> gaps    = filters.skills().stream()
                            .filter(s -> !matched.contains(s))
                            .collect(Collectors.toList());

                    return new TalentSearchResult(
                            rs.getString("id"),
                            rs.getString("name"),
                            rs.getString("job_title"),
                            rs.getString("company"),
                            rs.getString("linkedin_url"),
                            matched, gaps, score, 0,
                            "INTERNAL", true);
                }, loginId);
    }

    // ─── Step 3: CoreSignal search ────────────────────────────────────────────

    private List<TalentSearchResult> searchCoreSignal(SearchFilters filters, String loginId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + coreSignalApiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Build CoreSignal search payload
            Map<String, Object> payload = new HashMap<>();
            payload.put("query", buildCoreSignalQuery(filters));
            payload.put("size", 18);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    coreSignalBaseUrl + "/linkedin/member/search/filter",
                    HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return List.of();
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode results = root.path("results");

            List<TalentSearchResult> out = new ArrayList<>();
            if (results.isArray()) {
                for (JsonNode member : results) {
                    String name        = member.path("full_name").asText("Unknown");
                    String title       = member.path("title").asText("");
                    String company     = member.path("company").asText("");
                    String linkedinUrl = member.path("url").asText("");
                    int    yearsExp    = member.path("experience_months").asInt(0) / 12;

                    // Extract skills from CoreSignal profile
                    List<String> profileSkills = new ArrayList<>();
                    JsonNode skillsNode = member.path("skills");
                    if (skillsNode.isArray()) {
                        for (JsonNode s : skillsNode) {
                            profileSkills.add(s.asText());
                        }
                    }

                    List<String> matched = extractMatchedSkills(
                            String.join(" ", profileSkills), filters.skills());
                    List<String> gaps = filters.skills().stream()
                            .filter(s -> !matched.contains(s))
                            .collect(Collectors.toList());

                    int score = 50 + (matched.size() * 5);
                    score = Math.min(score, 99);

                    out.add(new TalentSearchResult(
                            null, name, title, company, linkedinUrl,
                            matched, gaps, score, yearsExp,
                            "CORESIGNAL", false));
                }
            }
            return out;

        } catch (Exception e) {
            System.err.println("CoreSignal search failed: " + e.getMessage());
            return List.of();
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private int scoreCandidate(String cvText, SearchFilters filters, int baseScore) {
        if (cvText == null) return baseScore;
        String lower = cvText.toLowerCase();
        long matches = filters.skills().stream()
                .filter(s -> lower.contains(s.toLowerCase()))
                .count();
        int bonus = filters.skills().isEmpty() ? 0 : (int) (matches * 10);
        return Math.min(baseScore + bonus, 99);
    }

    private List<String> extractMatchedSkills(String cvText, List<String> skills) {
        if (cvText == null || skills == null) return List.of();
        String lower = cvText.toLowerCase();
        return skills.stream()
                .filter(s -> lower.contains(s.toLowerCase()))
                .collect(Collectors.toList());
    }

    private String buildCoreSignalQuery(SearchFilters filters) {
        List<String> parts = new ArrayList<>();
        if (filters.skills() != null) parts.addAll(filters.skills());
        if (filters.industry() != null) parts.add(filters.industry());
        if (filters.seniority() != null) parts.add(filters.seniority());
        if (filters.keywords() != null) parts.addAll(filters.keywords());
        return String.join(" ", parts);
    }

    // ─── Inner record for AI-parsed filters ──────────────────────────────────

    private record SearchFilters(
            List<String> skills,
            String seniority,
            String industry,
            int minYearsExperience,
            List<String> keywords
    ) {}
}
