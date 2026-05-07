package com.nolyvra.app.service;

import com.nolyvra.app.model.TalentSearchRequest;
import com.nolyvra.app.model.TalentSearchResponse;
import com.nolyvra.app.model.TalentSearchResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
public class TalentSearchService {

    private static final int CACHE_MIN_RESULTS = 3;
    private static final int CACHE_DAYS_VALID  = 30;

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final ExecutorService profileFetchExecutor;
    private final String model;
    private final String coreSignalApiKey;
    private final String coreSignalBaseUrl;
    private final TokenService tokenService;

    public TalentSearchService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${coresignal.api-key:}") String coreSignalApiKey,
            @Value("${coresignal.base-url:https://api.coresignal.com/cdapi/v2}") String coreSignalBaseUrl) {
        this.jdbc = jdbc;
        this.openAI = openAIClient;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.restTemplate = new RestTemplate();
        this.profileFetchExecutor = Executors.newFixedThreadPool(3);
        this.model = model;
        this.coreSignalApiKey = coreSignalApiKey;
        this.coreSignalBaseUrl = coreSignalBaseUrl;
    }

    // ─── POST /api/talent-search/query ───────────────────────────────────────

    public TalentSearchResponse search(TalentSearchRequest req, String loginId) {

        if (!tokenService.deductToken(loginId))
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");

        // Step 1: Use AI to extract structured filters from the natural language query
        SearchFilters filters = extractFilters(req.query());

        // Step 2: Search internal DB candidates
        List<TalentSearchResult> internalResults = searchInternal(filters, loginId);

        // Step 3: Search CoreSignal (if API key configured)
        System.out.println("[CoreSignal] apiKey blank=" + (coreSignalApiKey == null || coreSignalApiKey.isBlank()) + " len=" + (coreSignalApiKey == null ? "null" : coreSignalApiKey.length()));
        List<TalentSearchResult> externalResults = coreSignalApiKey != null && !coreSignalApiKey.isBlank()
                ? searchCoreSignal(filters, loginId, req.query())
                : List.of();

        // Step 4: Paginate internal results separately; always surface CoreSignal on page 0
        internalResults.sort(Comparator.comparingInt(TalentSearchResult::matchScore).reversed());
        externalResults.sort(Comparator.comparingInt(TalentSearchResult::matchScore).reversed());

        int page = req.page() != null ? req.page() : 0;
        int pageSize = req.pageSize() != null ? req.pageSize() : 9;
        int from = page * pageSize;
        int to = Math.min(from + pageSize, internalResults.size());
        List<TalentSearchResult> paged = new ArrayList<>(
                from < internalResults.size() ? internalResults.subList(from, to) : List.of());
        if (page == 0) paged.addAll(externalResults);
        paged.sort(Comparator.comparingInt(TalentSearchResult::matchScore).reversed());

        return new TalentSearchResponse(
                req.query(),
                internalResults.size() + externalResults.size(),
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
                  "keywords": ["role-title keywords only"],
                  "location": "city or country if mentioned, otherwise null"
                }

                Rules:
                - keywords: job-title words only (e.g. "engineer", "developer"). Never put location, skills, or seniority here.
                - location: extract city/country/region if mentioned (e.g. "Melbourne", "Australia", "remote"). null if not mentioned.
                - skills: technical skills only.
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
            SearchFilters raw = objectMapper.readValue(clean, SearchFilters.class);
            // AI occasionally returns the string "null" instead of JSON null for optional fields
            SearchFilters result = new SearchFilters(
                    raw.skills(),
                    "null".equalsIgnoreCase(raw.seniority())  ? null : raw.seniority(),
                    "null".equalsIgnoreCase(raw.industry())   ? null : raw.industry(),
                    raw.minYearsExperience(),
                    raw.keywords(),
                    "null".equalsIgnoreCase(raw.location())   ? null : raw.location());
            System.out.println("[TalentSearch] extracted filters: skills=" + result.skills()
                    + " seniority=" + result.seniority()
                    + " keywords=" + result.keywords()
                    + " location=" + result.location());
            return result;
        } catch (Exception e) {
            System.err.println("[TalentSearch] extractFilters failed (" + e.getMessage() + "), using empty filters");
            return new SearchFilters(List.of(), null, null, 0, List.of(), null);
        }
    }

    // ─── Step 2: Internal DB search ───────────────────────────────────────────

    private List<TalentSearchResult> searchInternal(SearchFilters filters, String loginId) {

        // Get all candidates for this login with their latest analysis
        return jdbc.query("""
                select c.id, c.name, c.linkedin_url, c.cv_text, c.job_id,
                       coalesce(j.title, 'Not Assigned') as job_title,
                       coalesce(j.company, '') as company,
                       a.capability_score, a.risk_level
                from candidates c
                left join jobs j on j.id = c.job_id
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
                    List<String> gaps = filters.skills().stream()
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

    // ─── Step 3: CoreSignal search — two-call pattern ─────────────────────────

    private List<TalentSearchResult> searchCoreSignal(SearchFilters filters, String loginId,
                                                       String originalQuery) {
        try {
            // Try cache first
            List<TalentSearchResult> cached = searchCoreSignalCache(filters);
            System.out.println("[CoreSignal] cache results: " + cached.size());
            if (cached.size() >= CACHE_MIN_RESULTS) {
                System.out.println("[CoreSignal] serving from cache, skipping API call");
                List<Integer> aiScores = List.of();
                if (tokenService.deductToken(loginId)) {
                    aiScores = scoreWithAI(cached, originalQuery);
                }
                if (aiScores.size() == cached.size()) {
                    List<TalentSearchResult> scored = new ArrayList<>();
                    for (int i = 0; i < cached.size(); i++) {
                        TalentSearchResult p = cached.get(i);
                        scored.add(new TalentSearchResult(
                                p.candidateId(), p.name(), p.currentTitle(), p.currentCompany(),
                                p.linkedinUrl(), p.matchedSkills(), p.gapSkills(),
                                aiScores.get(i), p.yearsExperience(), p.source(), p.alreadyInPipeline()));
                    }
                    return scored;
                }
                return cached;
            }

            // Fix 2: use apikey header, not Authorization: Bearer
            HttpHeaders searchHeaders = new HttpHeaders();
            searchHeaders.set("apikey", coreSignalApiKey);
            searchHeaders.setContentType(MediaType.APPLICATION_JSON);

            // Fix 3 / Fix 4: POST ES DSL query to search endpoint
            Map<String, Object> esDslQuery = buildEsDslQuery(filters);
            try {
                System.out.println("[TalentSearch] ES DSL query: " + objectMapper.writeValueAsString(esDslQuery));
            } catch (Exception ignored) {}
            HttpEntity<Map<String, Object>> searchEntity = new HttpEntity<>(esDslQuery, searchHeaders);

            ResponseEntity<String> searchResp = restTemplate.exchange(
                    coreSignalBaseUrl + "/employee_clean/search/es_dsl",
                    HttpMethod.POST, searchEntity, String.class);

            String searchBody = searchResp.getBody();
            System.out.println("[TalentSearch] search HTTP=" + searchResp.getStatusCode()
                    + " body=" + (searchBody != null ? searchBody.substring(0, Math.min(300, searchBody.length())) : "null"));
            if (!searchResp.getStatusCode().is2xxSuccessful() || searchBody == null) {
                return List.of();
            }

            // Response is a plain integer array: [44067891, 69356050, ...]
            JsonNode idsNode = objectMapper.readTree(searchBody);
            if (!idsNode.isArray()) {
                System.out.println("[TalentSearch] unexpected response (not an array): " + searchBody);
                return List.of();
            }

            // Take first 3 IDs
            List<Long> ids = new ArrayList<>();
            for (int i = 0; i < Math.min(3, idsNode.size()); i++) {
                ids.add(idsNode.get(i).asLong());
            }
            System.out.println("[TalentSearch] search returned " + idsNode.size() + " IDs"
                    + (idsNode.size() == 0 ? " — no CoreSignal results for this query" : ", fetching first " + ids.size()));
            if (ids.isEmpty()) return List.of();

            // Collect profiles in parallel with a fixed thread pool of 3
            List<CompletableFuture<TalentSearchResult>> futures = ids.stream()
                    .map(id -> CompletableFuture.supplyAsync(
                            () -> fetchProfile(id, filters), profileFetchExecutor))
                    .collect(Collectors.toList());

            List<TalentSearchResult> profiles = futures.stream()
                    .map(CompletableFuture::join)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            if (profiles.isEmpty()) return List.of();

            // Fix 6: score with OpenAI, fall back to existing scoreCandidate logic
            List<Integer> aiScores = List.of();
            if (tokenService.deductToken(loginId)) {
                aiScores = scoreWithAI(profiles, originalQuery);
            }
            if (aiScores.size() == profiles.size()) {
                List<TalentSearchResult> scored = new ArrayList<>();
                for (int i = 0; i < profiles.size(); i++) {
                    TalentSearchResult p = profiles.get(i);
                    scored.add(new TalentSearchResult(
                            p.candidateId(), p.name(), p.currentTitle(), p.currentCompany(),
                            p.linkedinUrl(), p.matchedSkills(), p.gapSkills(),
                            aiScores.get(i), p.yearsExperience(), p.source(), p.alreadyInPipeline()));
                }
                return scored;
            }

            return profiles;

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            System.err.println("[CoreSignal] HTTP " + e.getStatusCode() + " – " + e.getResponseBodyAsString());
            return List.of();
        } catch (org.springframework.web.client.HttpServerErrorException e) {
            System.err.println("[CoreSignal] HTTP " + e.getStatusCode() + " – " + e.getResponseBodyAsString());
            return List.of();
        } catch (Exception e) {
            System.err.println("[CoreSignal] search failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return List.of();
        }
    }

    // ─── Fetch a single profile by ID (used by CompletableFuture) ────────────

    private TalentSearchResult fetchProfile(long id, SearchFilters filters) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", coreSignalApiKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> resp = restTemplate.exchange(
                    coreSignalBaseUrl + "/employee_clean/collect/" + id,
                    HttpMethod.GET, entity, String.class);

            System.out.println("[CoreSignal] profile " + id + " HTTP " + resp.getStatusCode() + " bodyLen=" + (resp.getBody() != null ? resp.getBody().length() : "null"));
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return null;

            // Fix 5: correct field names from confirmed API response
            JsonNode profile = objectMapper.readTree(resp.getBody());

            String name        = profile.path("full_name").asText("Unknown");
            String title       = profile.path("job_title").asText("");
            String linkedinUrl = profile.path("websites_linkedin").asText("");
            int yearsExp       = profile.path("total_experience_duration_months").asInt(0) / 12;

            // location fields available but not stored in TalentSearchResult (no field for it)

            String company = "";
            JsonNode experience = profile.path("experience");
            if (experience.isArray() && experience.size() > 0) {
                company = experience.get(0).path("company_name").asText("");
            }

            List<String> profileSkills = new ArrayList<>();
            JsonNode skillsNode = profile.path("skills");
            if (skillsNode.isArray()) {
                for (JsonNode s : skillsNode) profileSkills.add(s.asText());
            }

            List<String> matched = extractMatchedSkills(String.join(" ", profileSkills), filters.skills());
            List<String> gaps = filters.skills().stream()
                    .filter(s -> !matched.contains(s))
                    .collect(Collectors.toList());

            int score = 50 + (matched.size() * 5);
            score = Math.min(score, 99);

            // Save to cache before returning
            try {
                String skillsJson = objectMapper.writeValueAsString(profileSkills);
                System.out.println("[CoreSignal] cache saving id=" + id + " name=" + name + " skills=" + profileSkills.size() + " skillsJson=" + skillsJson);
                jdbc.update("""
                    insert into coresignal_cache
                        (coresignal_id, full_name, job_title, current_company,
                         location_city, location_country, linkedin_url, skills,
                         years_experience, management_level, description, raw_json)
                    values (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?, CAST(? AS jsonb))
                    on conflict (coresignal_id) do update set
                        full_name        = excluded.full_name,
                        job_title        = excluded.job_title,
                        current_company  = excluded.current_company,
                        location_city    = excluded.location_city,
                        location_country = excluded.location_country,
                        linkedin_url     = excluded.linkedin_url,
                        skills           = excluded.skills,
                        years_experience = excluded.years_experience,
                        management_level = excluded.management_level,
                        description      = excluded.description,
                        raw_json         = excluded.raw_json,
                        cached_at        = now(),
                        last_searched_at = now()
                    """,
                    id,
                    name,
                    title,
                    company,
                    profile.path("location_city").asText(null),
                    profile.path("location_country").asText(null),
                    linkedinUrl,
                    skillsJson,
                    yearsExp,
                    profile.path("management_level").asText(null),
                    profile.path("description").asText(null),
                    resp.getBody());
                System.out.println("[CoreSignal] cache saved id=" + id);
            } catch (Exception e) {
                System.err.println("[CoreSignal] cache save FAILED for id " + id + ": " + e);
                e.printStackTrace(System.err);
            }

            return new TalentSearchResult(
                    null, name, title, company, linkedinUrl,
                    matched, gaps, score, yearsExp,
                    "CORESIGNAL", false);

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            System.err.println("[CoreSignal] profile " + id + " HTTP " + e.getStatusCode() + " – " + e.getResponseBodyAsString());
            return null;
        } catch (Exception e) {
            System.err.println("[CoreSignal] profile " + id + " failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return null;
        }
    }

    // ─── CoreSignal cache lookup ──────────────────────────────────────────────

    private List<TalentSearchResult> searchCoreSignalCache(SearchFilters filters) {
        try {
            StringBuilder sql = new StringBuilder(
                    "select coresignal_id, full_name, job_title, current_company," +
                    " linkedin_url, skills, years_experience" +
                    " from coresignal_cache" +
                    " where cached_at > now() - interval '" + CACHE_DAYS_VALID + " days'");

            List<Object> args = new ArrayList<>();

            String titleQuery = buildTitleQuery(filters);
            if (titleQuery != null && !titleQuery.isBlank()) {
                sql.append(" and lower(job_title) like lower(?) ");
                args.add("%" + titleQuery + "%");
            }

            if (filters.location() != null && !filters.location().isBlank()) {
                sql.append(" and (lower(location_city) like lower(?) or lower(location_country) like lower(?)) ");
                args.add("%" + filters.location() + "%");
                args.add("%" + filters.location() + "%");
            }

            if (filters.skills() != null && !filters.skills().isEmpty()) {
                List<String> orClauses = new ArrayList<>();
                for (String skill : filters.skills()) {
                    orClauses.add("skills::text ilike ?");
                    args.add("%" + skill + "%");
                }
                sql.append(" and (").append(String.join(" or ", orClauses)).append(") ");
            }

            sql.append(" order by last_searched_at desc limit 20");

            return jdbc.query(sql.toString(), (rs, rowNum) -> {
                List<String> skills = new ArrayList<>();
                try {
                    JsonNode skillsNode = objectMapper.readTree(
                        rs.getString("skills") != null ? rs.getString("skills") : "[]");
                    if (skillsNode.isArray()) {
                        for (JsonNode s : skillsNode) skills.add(s.asText());
                    }
                } catch (Exception ignored) {}

                List<String> matched = extractMatchedSkills(
                    String.join(" ", skills), filters.skills());
                List<String> gaps = filters.skills().stream()
                    .filter(s -> !matched.contains(s))
                    .collect(Collectors.toList());
                int score = 50 + (matched.size() * 5);
                score = Math.min(score, 99);

                jdbc.update("update coresignal_cache set last_searched_at = now() where coresignal_id = ?",
                    rs.getLong("coresignal_id"));

                return new TalentSearchResult(
                    null,
                    rs.getString("full_name"),
                    rs.getString("job_title"),
                    rs.getString("current_company"),
                    rs.getString("linkedin_url"),
                    matched, gaps, score,
                    rs.getInt("years_experience"),
                    "CORESIGNAL", false);
            }, args.toArray());

        } catch (Exception e) {
            System.err.println("[CoreSignal] cache search failed: " + e.getMessage());
            return List.of();
        }
    }

    // ─── Fix 6: Score CoreSignal results with OpenAI ──────────────────────────

    private List<Integer> scoreWithAI(List<TalentSearchResult> profiles, String originalQuery) {
        try {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < profiles.size(); i++) {
                TalentSearchResult p = profiles.get(i);
                sb.append(i + 1).append(". ")
                  .append(p.name()).append(" | ")
                  .append(p.currentTitle()).append(" | ")
                  .append(p.currentCompany()).append(" | Skills: ")
                  .append(String.join(", ", p.matchedSkills()))
                  .append("\n");
            }

            String systemPrompt = """
                    You are a recruitment matcher. Score each candidate 0-100 against the query.
                    Return ONLY a JSON array of integers in the same order: [85, 72, 60, ...]""";
            String userPrompt = "Query: " + originalQuery + "\n\nCandidates:\n" + sb;

            var params = ChatCompletionCreateParams.builder()
                    .model(model)
                    .addSystemMessage(systemPrompt)
                    .addUserMessage(userPrompt)
                    .temperature(0.1)
                    .build();

            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content().orElse("[]");
            String clean = content.strip()
                    .replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();

            JsonNode arr = objectMapper.readTree(clean);
            List<Integer> scores = new ArrayList<>();
            if (arr.isArray()) {
                for (JsonNode n : arr) scores.add(n.asInt(50));
            }
            return scores;
        } catch (Exception e) {
            System.err.println("AI scoring failed, using fallback: " + e.getMessage());
            return List.of();
        }
    }

    // ─── Fix 4: ES DSL query builder ─────────────────────────────────────────

    private Map<String, Object> buildEsDslQuery(SearchFilters filters) {
        List<Map<String, Object>> mustClauses = new ArrayList<>();

        String titleQuery = buildTitleQuery(filters);
        if (titleQuery != null) {
            mustClauses.add(Map.of("match_phrase", Map.of("job_title", titleQuery)));
        }

        if (filters.skills() != null && !filters.skills().isEmpty()) {
            List<Map<String, Object>> shouldSkills = filters.skills().stream()
                    .map(s -> Map.<String, Object>of("match_phrase", Map.of("skills", s)))
                    .collect(Collectors.toList());
            mustClauses.add(Map.of("bool", Map.of(
                    "should", shouldSkills,
                    "minimum_should_match", 1)));
        }

        if (filters.location() != null && !filters.location().isBlank()) {
            mustClauses.add(Map.of("bool", Map.of(
                    "should", List.of(
                            Map.of("match", Map.of("location_city", filters.location())),
                            Map.of("match", Map.of("location_country", filters.location()))),
                    "minimum_should_match", 1)));
        }

        List<Map<String, Object>> filterList = List.of(
                Map.of("term", Map.of("is_deleted", 0)));

        return Map.of("query", Map.of("bool", Map.of(
                "must", mustClauses,
                "filter", filterList)));
    }

    private String buildTitleQuery(SearchFilters filters) {
        List<String> parts = new ArrayList<>();
        if (filters.seniority() != null) parts.add(filters.seniority());
        if (filters.keywords() != null) parts.addAll(filters.keywords());
        return parts.isEmpty() ? null : String.join(" ", parts);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private int scoreCandidate(String cvText, SearchFilters filters, int baseScore) {
        if (cvText == null)
            return baseScore;
        String lower = cvText.toLowerCase();
        long matches = filters.skills().stream()
                .filter(s -> lower.contains(s.toLowerCase()))
                .count();
        int bonus = filters.skills().isEmpty() ? 0 : (int) (matches * 10);
        return Math.min(baseScore + bonus, 99);
    }

    private List<String> extractMatchedSkills(String cvText, List<String> skills) {
        if (cvText == null || skills == null)
            return List.of();
        String lower = cvText.toLowerCase();
        return skills.stream()
                .filter(s -> lower.contains(s.toLowerCase()))
                .collect(Collectors.toList());
    }

    // ─── Inner record for AI-parsed filters ──────────────────────────────────

    private record SearchFilters(
            List<String> skills,
            String seniority,
            String industry,
            int minYearsExperience,
            List<String> keywords,
            String location) {
    }
}
