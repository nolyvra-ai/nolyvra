package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateFilterRequest;
import com.nolyvra.app.model.CandidateSearchResult;
import com.nolyvra.app.model.CoreSignalProfileResponse;
import com.nolyvra.app.model.JobResponse;
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

import java.math.BigDecimal;
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
        // Sort via stream (not in-place .sort()) since these lists may be the immutable List.of()
        internalResults = internalResults.stream()
                .sorted(Comparator.comparingInt(TalentSearchResult::matchScore).reversed())
                .collect(Collectors.toList());
        externalResults = externalResults.stream()
                .sorted(Comparator.comparingInt(TalentSearchResult::matchScore).reversed())
                .collect(Collectors.toList());

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

    // ─── GET /api/talent-search/coresignal/{id} ──────────────────────────────

    public CoreSignalProfileResponse getCoreSignalProfile(Long coresignalId) {
        return jdbc.query("""
                select coresignal_id, full_name, job_title, current_company,
                       location_city, location_country, linkedin_url,
                       years_experience, management_level, description,
                       skills, raw_json
                from coresignal_cache
                where coresignal_id = ?
                """,
                (rs, rowNum) -> {
                    List<String> skills = new ArrayList<>();
                    try {
                        JsonNode node = objectMapper.readTree(
                                rs.getString("skills") != null ? rs.getString("skills") : "[]");
                        if (node.isArray()) node.forEach(s -> skills.add(s.asText()));
                    } catch (Exception ignored) {}
                    return new CoreSignalProfileResponse(
                            rs.getLong("coresignal_id"),
                            rs.getString("full_name"),
                            rs.getString("job_title"),
                            rs.getString("current_company"),
                            rs.getString("location_city"),
                            rs.getString("location_country"),
                            rs.getString("linkedin_url"),
                            rs.getObject("years_experience") != null ? rs.getInt("years_experience") : null,
                            rs.getString("management_level"),
                            rs.getString("description"),
                            skills,
                            rs.getString("raw_json"));
                }, coresignalId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Profile not found in cache: " + coresignalId));
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
                select c.id, c.name, c.email, c.phone_number, c.linkedin_url, c.cv_text, c.job_id,
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
                            rs.getString("email"),
                            rs.getString("phone_number"),
                            matched, gaps, score, 0,
                            "INTERNAL", true, null);
                }, loginId);
    }

    // ─── Step 3: CoreSignal search — two-call pattern ─────────────────────────

    private List<TalentSearchResult> searchCoreSignal(SearchFilters filters, String loginId,
                                                       String originalQuery) {
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
                            p.linkedinUrl(), p.email(), p.phone(),
                            p.matchedSkills(), p.gapSkills(),
                            aiScores.get(i), p.yearsExperience(), p.source(), p.alreadyInPipeline(),
                            p.coresignalId()));
                }
                return scored;
            }
            return cached;
        }

        List<TalentSearchResult> profiles = fetchCoreSignalLive(filters);
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
                        p.linkedinUrl(), p.email(), p.phone(),
                        p.matchedSkills(), p.gapSkills(),
                        aiScores.get(i), p.yearsExperience(), p.source(), p.alreadyInPipeline(),
                        p.coresignalId()));
            }
            return scored;
        }

        return profiles;
    }

    // ─── Live CoreSignal API call (search + parallel profile fetch) ──────────
    // Extracted so job-based searches can reuse it without the NL-query/AI
    // re-scoring wrapper above. Capped to 3 results — keep it that way; each
    // result here is a billed CoreSignal API call.

    private List<TalentSearchResult> fetchCoreSignalLive(SearchFilters filters) {
        try {
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

            // Take first 3 IDs — each one is a billed CoreSignal API call
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

            return futures.stream()
                    .map(CompletableFuture::join)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

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

    // ─── Job-based candidate search (Suitable/External Candidates panel) ─────
    // No OpenAI call, no token deduction — cheap skill/title-overlap scoring
    // only. Cache is always checked first; live CoreSignal is only called
    // when the cache has fewer than 3 hits, and always capped to 3 results.

    public List<TalentSearchResult> searchCoreSignalForJob(List<String> skills, String location,
                                                             String title, String seniority) {
        if (coreSignalApiKey == null || coreSignalApiKey.isBlank()) return List.of();

        SearchFilters filters = new SearchFilters(
                skills != null ? skills : List.of(),
                seniority,
                null,
                0,
                title != null && !title.isBlank() ? List.of(title) : List.of(),
                location);

        List<TalentSearchResult> cached = searchCoreSignalCache(filters);
        if (cached.size() >= CACHE_MIN_RESULTS) {
            return cached.stream().limit(3).collect(Collectors.toList());
        }

        List<TalentSearchResult> live = fetchCoreSignalLive(filters);
        return live.stream().limit(3).collect(Collectors.toList());
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
                    null, name, title, company, linkedinUrl, null, null,
                    matched, gaps, score, yearsExp,
                    "CORESIGNAL", false, id);

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
                    null, null,
                    matched, gaps, score,
                    rs.getInt("years_experience"),
                    "CORESIGNAL", false, rs.getLong("coresignal_id"));
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

    // ─── GET /api/jobs/{jobId}/suitable-candidates ────────────────────────────
    // Top 10 internal candidates for a job, matched on title + skills + location.
    // Reuses the same rule-based scoring as the Smart Talent Lens page.

    public List<CandidateSearchResult> suitableInternalCandidatesForJob(JobResponse job, String loginId) {
        CandidateFilterRequest filters = CandidateFilterRequest.builder()
                .skills(job.stackTags() != null ? job.stackTags() : List.of())
                .jobTitleKeywords(job.title())
                .location(job.location())
                .build();
        return scoreInternalCandidates(filters, loginId).stream()
                .limit(10)
                .collect(Collectors.toList());
    }

    // ─── POST /api/candidates/search (Smart Talent Lens structured filters) ──
    // Rule-based scoring only against internal candidates — no OpenAI call,
    // no token deduction (unlike the natural-language search() above).

    public List<CandidateSearchResult> scoreInternalCandidates(CandidateFilterRequest filters, String loginId) {
        List<String> skills = filters.skills() != null ? filters.skills() : List.of();

        // Resolve the search location once; candidate locations are resolved
        // lazily per unique (suburb, state) pair below to avoid N+1 lookups.
        double[] searchCoords = resolveLocality(filters.location(), filters.state());
        Map<String, double[]> localityCache = new HashMap<>();

        return jdbc.query("""
                select c.id, c.name, c.email, c.phone_number, c.linkedin_url, c.cv_text, c.job_id,
                       c.current_title, c.location, c.state, c.years_experience, c.seniority_level,
                       c.expected_salary_min, c.expected_salary_max, c.salary_currency,
                       c.notice_period_weeks, c.work_rights, c.remote_flexible, c.skills, c.updated_at,
                       coalesce(j.title, 'Not Assigned') as job_title,
                       coalesce(j.company, '') as company,
                       a.id as analysis_id, a.consistency_score, a.capability_score, a.risk_level
                from candidates c
                left join jobs j on j.id = c.job_id
                left join lateral (
                    select id, consistency_score, capability_score, risk_level
                    from analyses
                    where candidate_id = c.id
                    order by analyzed_at desc limit 1
                ) a on true
                where c.login_id = ?
                  and c.is_active = true
                """,
                (rs, rowNum) -> {
                    String cvText = rs.getString("cv_text");
                    List<String> matched = extractMatchedSkills(cvText, skills);
                    List<String> gaps = skills.stream()
                            .filter(s -> !matched.contains(s))
                            .collect(Collectors.toList());

                    String candidateLocation = rs.getString("location");
                    String candidateState = rs.getString("state");
                    Double distanceKm = null;
                    if (searchCoords != null && candidateLocation != null && !candidateLocation.isBlank()
                            && candidateState != null && !candidateState.isBlank()) {
                        String cacheKey = candidateLocation.trim().toLowerCase() + "|" + candidateState.trim().toUpperCase();
                        double[] candCoords = localityCache.computeIfAbsent(cacheKey,
                                k -> resolveLocality(candidateLocation, candidateState));
                        if (candCoords != null) {
                            distanceKm = haversineKm(searchCoords[0], searchCoords[1], candCoords[0], candCoords[1]);
                        }
                    }

                    Integer capabilityScore = (Integer) rs.getObject("capability_score");
                    int score = scoreAgainstFilters(filters, matched.size(),
                            capabilityScore != null ? capabilityScore : 50,
                            candidateLocation, distanceKm, rs.getString("current_title"),
                            rs.getBigDecimal("years_experience"),
                            rs.getString("seniority_level"),
                            rs.getBigDecimal("expected_salary_min"),
                            rs.getBigDecimal("expected_salary_max"),
                            (Integer) rs.getObject("notice_period_weeks"),
                            rs.getString("work_rights"),
                            (Boolean) rs.getObject("remote_flexible"));

                    Long analysisId = (Long) rs.getObject("analysis_id");
                    String linkedinUrl = rs.getString("linkedin_url");
                    java.time.OffsetDateTime updatedAt = rs.getObject("updated_at", java.time.OffsetDateTime.class);

                    return CandidateSearchResult.builder()
                            .candidateId(rs.getString("id"))
                            .name(rs.getString("name"))
                            .email(rs.getString("email"))
                            .phone(rs.getString("phone_number"))
                            .linkedinUrl(linkedinUrl)
                            .verified(linkedinUrl != null && !linkedinUrl.isBlank())
                            .jobId(rs.getString("job_id"))
                            .jobTitle(rs.getString("job_title"))
                            .currentTitle(rs.getString("current_title"))
                            .currentCompany(rs.getString("company"))
                            .location(rs.getString("location"))
                            .state(rs.getString("state"))
                            .distanceKm(distanceKm)
                            .skills(parseSkillsJson(rs.getString("skills")))
                            .updatedAt(updatedAt != null ? updatedAt.toInstant() : null)
                            .yearsExperience(rs.getBigDecimal("years_experience"))
                            .seniorityLevel(rs.getString("seniority_level"))
                            .expectedSalaryMin(rs.getBigDecimal("expected_salary_min"))
                            .expectedSalaryMax(rs.getBigDecimal("expected_salary_max"))
                            .salaryCurrency(rs.getString("salary_currency"))
                            .noticePeriodWeeks((Integer) rs.getObject("notice_period_weeks"))
                            .workRights(rs.getString("work_rights"))
                            .remoteFlexible((Boolean) rs.getObject("remote_flexible"))
                            .matchedSkills(matched)
                            .gapSkills(gaps)
                            .matchScore(score)
                            .matchTier(matchTier(score))
                            .consistencyScore((Integer) rs.getObject("consistency_score"))
                            .capabilityScore(capabilityScore)
                            .riskLevel(rs.getString("risk_level"))
                            .status(analysisId != null ? "Analysed" : "Pending")
                            .build();
                }, loginId)
                .stream()
                .sorted(Comparator.comparingInt(CandidateSearchResult::matchScore).reversed())
                .collect(Collectors.toList());
    }

    private int scoreAgainstFilters(CandidateFilterRequest filters, int matchedSkillCount, int baseScore,
            String candidateLocation, Double distanceKm, String candidateTitle, BigDecimal candidateYears,
            String candidateSeniority, BigDecimal candidateSalaryMin, BigDecimal candidateSalaryMax,
            Integer candidateNoticeWeeks, String candidateWorkRights, Boolean candidateRemoteFlexible) {

        int score = baseScore;
        List<String> skills = filters.skills() != null ? filters.skills() : List.of();
        score += skills.isEmpty() ? 0 : matchedSkillCount * 10;

        if (filters.jobTitleKeywords() != null && !filters.jobTitleKeywords().isBlank()
                && candidateTitle != null && !candidateTitle.isBlank()) {
            // Title match is a bonus signal only — no penalty if it doesn't match,
            // since recruiters often search across adjacent/related titles too.
            if (candidateTitle.toLowerCase().contains(filters.jobTitleKeywords().toLowerCase())
                    || filters.jobTitleKeywords().toLowerCase().contains(candidateTitle.toLowerCase())) {
                score += 10;
            }
        }

        if (filters.radiusKm() != null && distanceKm != null) {
            // Real distance available (both locations geocoded) — prefer this over text matching.
            score += distanceKm <= filters.radiusKm() ? 10 : -10;
        } else if (filters.location() != null && !filters.location().isBlank()) {
            if (candidateLocation != null
                    && candidateLocation.toLowerCase().contains(filters.location().toLowerCase())) {
                score += 10;
            } else if (candidateLocation != null) {
                score -= 5;
            }
        }

        if (candidateYears != null && (filters.minYears() != null || filters.maxYears() != null)) {
            boolean withinRange =
                    (filters.minYears() == null || candidateYears.compareTo(filters.minYears()) >= 0) &&
                    (filters.maxYears() == null || candidateYears.compareTo(filters.maxYears()) <= 0);
            score += withinRange ? 5 : -5;
        }

        if (filters.seniorityLevel() != null && !filters.seniorityLevel().isBlank() && candidateSeniority != null) {
            score += candidateSeniority.equalsIgnoreCase(filters.seniorityLevel()) ? 5 : -5;
        }

        if ((filters.salaryMin() != null || filters.salaryMax() != null)
                && candidateSalaryMin != null && candidateSalaryMax != null) {
            boolean overlaps =
                    (filters.salaryMax() == null || candidateSalaryMin.compareTo(filters.salaryMax()) <= 0) &&
                    (filters.salaryMin() == null || candidateSalaryMax.compareTo(filters.salaryMin()) >= 0);
            score += overlaps ? 5 : -10;
        }

        if (filters.noticePeriodMaxWeeks() != null && candidateNoticeWeeks != null) {
            score += candidateNoticeWeeks <= filters.noticePeriodMaxWeeks() ? 5 : -5;
        }

        if (filters.workRights() != null && !filters.workRights().isBlank()
                && !"any".equalsIgnoreCase(filters.workRights()) && candidateWorkRights != null) {
            score += candidateWorkRights.equalsIgnoreCase(filters.workRights()) ? 5 : -10;
        }

        if (Boolean.TRUE.equals(filters.remoteFlexible()) && Boolean.TRUE.equals(candidateRemoteFlexible)) {
            score += 5;
        }

        return Math.max(5, Math.min(score, 99));
    }

    private String matchTier(int score) {
        if (score >= 85) return "Strong Match";
        if (score >= 65) return "Hidden Gem";
        if (score >= 40) return "Needs Review";
        return "Not Recommended";
    }

    // ─── Proximity (Location Intelligence radius slider) ──────────────────────
    // Suburb-level lookup against the GeoNames-derived au_localities reference
    // table. Matches on suburb + state (checking both state code and full name,
    // since candidate.state is free text and may contain either form).

    private double[] resolveLocality(String suburb, String state) {
        if (suburb == null || suburb.isBlank() || state == null || state.isBlank()) return null;
        return jdbc.query("""
                select latitude, longitude from au_localities
                where lower(suburb) = lower(?)
                  and (upper(state_code) = upper(?) or lower(state_name) = lower(?))
                limit 1
                """,
                (rs, rowNum) -> new double[]{ rs.getDouble("latitude"), rs.getDouble("longitude") },
                suburb.trim(), state.trim(), state.trim())
                .stream().findFirst().orElse(null);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private List<String> parseSkillsJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode node = objectMapper.readTree(json);
            List<String> skills = new ArrayList<>();
            if (node.isArray()) {
                node.forEach(s -> skills.add(s.asText()));
            }
            return skills;
        } catch (Exception e) {
            return List.of();
        }
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
