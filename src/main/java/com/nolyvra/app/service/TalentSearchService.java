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
import java.util.stream.Collectors;

@Service
public class TalentSearchService {

    private static final int CACHE_DAYS_VALID   = 30;
    private static final int EXTERNAL_BATCH_SIZE = 5;   // 5 random-cached + 5 fresh from Bright Data, every call

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final String model;
    private final String brightDataApiKey;
    private final String brightDataDatasetId;
    private final String brightDataBaseUrl;
    private final TokenService tokenService;

    public TalentSearchService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${brightdata.api-key:}") String brightDataApiKey,
            @Value("${brightdata.dataset-id:gd_l1viktl72bvl7bjuj0}") String brightDataDatasetId,
            @Value("${brightdata.base-url:https://api.brightdata.com}") String brightDataBaseUrl) {
        this.jdbc = jdbc;
        this.openAI = openAIClient;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.restTemplate = new RestTemplate();
        this.model = model;
        this.brightDataApiKey = brightDataApiKey;
        this.brightDataDatasetId = brightDataDatasetId;
        this.brightDataBaseUrl = brightDataBaseUrl;
    }

    // ─── POST /api/talent-search/query ───────────────────────────────────────

    public TalentSearchResponse search(TalentSearchRequest req, String loginId) {

        if (!tokenService.deductToken(loginId))
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");

        // Step 1: Use AI to extract structured filters from the natural language query
        SearchFilters filters = extractFilters(req.query());

        // Step 2: Search internal DB candidates
        List<TalentSearchResult> internalResults = searchInternal(filters, loginId);

        // Step 3: Search Bright Data (if API key configured)
        List<TalentSearchResult> externalResults = brightDataApiKey != null && !brightDataApiKey.isBlank()
                ? searchExternal(filters, loginId, req.query())
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

    public CoreSignalProfileResponse getCoreSignalProfile(String coresignalId) {
        CoreSignalProfileResponse profile = jdbc.query("""
                select coresignal_id, full_name, job_title, current_company,
                       location_city, location_country, linkedin_url,
                       years_experience, management_level, description,
                       skills, avatar_url, default_avatar, raw_json
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
                            rs.getString("coresignal_id"),
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
                            rs.getString("avatar_url"),
                            (Boolean) rs.getObject("default_avatar"),
                            rs.getString("raw_json"));
                }, coresignalId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Profile not found in cache: " + coresignalId));

        // Skills are not provided by Bright Data — generate lazily on first view, then persist
        // so subsequent views are a cache hit. Free/unbilled: no TokenService.deductToken here.
        if (profile.skills() == null || profile.skills().isEmpty()) {
            List<String> generated = generateSkillsFromText(profile.description(), profile.rawJson());
            if (!generated.isEmpty()) {
                try {
                    String skillsJson = objectMapper.writeValueAsString(generated);
                    jdbc.update("update coresignal_cache set skills = CAST(? AS jsonb) where coresignal_id = ?",
                            skillsJson, coresignalId);
                } catch (Exception e) {
                    System.err.println("[BrightData] failed to persist generated skills for " + coresignalId + ": " + e.getMessage());
                }
                profile = new CoreSignalProfileResponse(
                        profile.coresignalId(), profile.fullName(), profile.jobTitle(), profile.currentCompany(),
                        profile.locationCity(), profile.locationCountry(), profile.linkedinUrl(),
                        profile.yearsExperience(), profile.managementLevel(), profile.description(),
                        generated, profile.avatarUrl(), profile.defaultAvatar(), profile.rawJson());
            }
        }
        return profile;
    }

    // ─── Lazy skills generation (about + experience text -> skills) ──────────
    // Bright Data doesn't supply skills. Modeled on OpenAICvFieldExtractor's
    // skills-extraction prompt/parsing pattern, scoped to skills only and not
    // billed against the recruiter's token balance.

    private List<String> generateSkillsFromText(String about, String rawJson) {
        try {
            StringBuilder text = new StringBuilder();
            if (about != null && !about.isBlank()) text.append(about).append("\n\n");
            if (rawJson != null && !rawJson.isBlank()) {
                JsonNode raw = objectMapper.readTree(rawJson);
                JsonNode exp = raw.path("experience");
                if (exp.isArray()) {
                    for (JsonNode e : exp) {
                        text.append(e.path("title").asText(""))
                            .append(" ").append(e.path("company").asText(""))
                            .append(" ").append(e.path("description_html").asText(""))
                            .append("\n");
                    }
                }
            }
            if (text.isEmpty()) return List.of();

            String systemPrompt = """
                    You extract technical/professional skills from a candidate's bio and work history.
                    Return EXACTLY ONE JSON array of up to 15 skills, ordered by relevance, no markdown:
                    ["skill1", "skill2", ...]""";

            var params = ChatCompletionCreateParams.builder()
                    .model(model)
                    .addSystemMessage(systemPrompt)
                    .addUserMessage(text.toString())
                    .temperature(0.1)
                    .build();

            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content().orElse("[]");
            String clean = content.strip()
                    .replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();

            JsonNode arr = objectMapper.readTree(clean);
            List<String> skills = new ArrayList<>();
            if (arr.isArray()) arr.forEach(s -> skills.add(s.asText()));
            return skills;
        } catch (Exception e) {
            System.err.println("[BrightData] skill generation failed: " + e.getMessage());
            return List.of();
        }
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
                            "INTERNAL", true, null, null, null);
                }, loginId);
    }

    // ─── External search (Bright Data) — shared by NL search, job-page search, ──
    // and both "Load more external candidates" endpoints. Every call is the
    // same stateless operation: 5 random candidates already cached for this
    // term + 5 fresh candidates pulled live from Bright Data, deduped against
    // what's already cached for the term.

    private List<TalentSearchResult> searchExternal(SearchFilters filters, String loginId,
                                                      String originalQuery) {
        List<TalentSearchResult> results = fetchExternalCandidates(filters);
        return applyAiScoring(results, originalQuery, loginId);
    }

    public List<TalentSearchResult> loadMoreExternal(String originalQuery, String loginId) {
        SearchFilters filters = extractFilters(originalQuery);
        List<TalentSearchResult> results = fetchExternalCandidates(filters);
        return applyAiScoring(results, originalQuery, loginId);
    }

    private List<TalentSearchResult> applyAiScoring(List<TalentSearchResult> results,
                                                      String originalQuery, String loginId) {
        if (results.isEmpty()) return results;
        List<Integer> aiScores = List.of();
        if (tokenService.deductToken(loginId)) {
            aiScores = scoreWithAI(results, originalQuery);
        }
        if (aiScores.size() != results.size()) return results;
        List<TalentSearchResult> scored = new ArrayList<>();
        for (int i = 0; i < results.size(); i++) {
            TalentSearchResult p = results.get(i);
            scored.add(new TalentSearchResult(
                    p.candidateId(), p.name(), p.currentTitle(), p.currentCompany(),
                    p.linkedinUrl(), p.email(), p.phone(),
                    p.matchedSkills(), p.gapSkills(),
                    aiScores.get(i), p.yearsExperience(), p.source(), p.alreadyInPipeline(),
                    p.coresignalId(), p.avatarUrl(), p.defaultAvatar()));
        }
        return scored;
    }

    // ─── Job-based candidate search (Suitable/External Candidates panel) ─────
    // No OpenAI call, no token deduction — cheap skill/title-overlap scoring
    // baked in at fetch time (see fetchExternalCandidates / mapBrightDataRecord).

    public List<TalentSearchResult> searchCoreSignalForJob(List<String> skills, String location,
                                                             String title, String seniority) {
        if (brightDataApiKey == null || brightDataApiKey.isBlank()) return List.of();
        return fetchExternalCandidates(buildJobFilters(skills, location, title, seniority));
    }

    public List<TalentSearchResult> loadMoreExternalForJob(List<String> skills, String location,
                                                             String title, String seniority) {
        if (brightDataApiKey == null || brightDataApiKey.isBlank()) return List.of();
        return fetchExternalCandidates(buildJobFilters(skills, location, title, seniority));
    }

    private static final Set<String> SENIORITY_WORDS = Set.of(
            "junior", "mid", "mid-level", "senior", "lead", "principal", "staff", "director", "head");

    // Bright Data's "position" filter is a phrase match — the full raw job
    // title ("Senior UX Engineer") almost never matches a real LinkedIn title
    // verbatim. Reduce to the core role noun (last non-seniority word) so the
    // query is as loose as what the natural-language/AI-extracted path sends
    // (e.g. "Senior Engineer" instead of "Senior UX Engineer").
    private String coreTitleKeyword(String title) {
        if (title == null || title.isBlank()) return null;
        String[] words = title.trim().split("\\s+");
        List<String> filtered = new ArrayList<>();
        for (String w : words) {
            if (!SENIORITY_WORDS.contains(w.toLowerCase())) filtered.add(w);
        }
        if (filtered.isEmpty()) return null;
        return filtered.get(filtered.size() - 1);
    }

    private SearchFilters buildJobFilters(List<String> skills, String location, String title, String seniority) {
        String keyword = coreTitleKeyword(title);
        return new SearchFilters(
                skills != null ? skills : List.of(),
                seniority,
                null,
                0,
                keyword != null ? List.of(keyword) : List.of(),
                location);
    }

    // ─── Shared external-fetch core: 5 random cached + 5 fresh from Bright Data ──

    private List<TalentSearchResult> fetchExternalCandidates(SearchFilters filters) {
        List<TalentSearchResult> combined = new ArrayList<>(randomCachedResults(filters, EXTERNAL_BATCH_SIZE));
        combined.addAll(fetchBrightDataLive(filters, EXTERNAL_BATCH_SIZE));
        return combined;
    }

    // ─── Bright Data live call: trigger filter -> poll snapshot -> parse -> ──
    // dedupe against what's already cached for this term -> upsert -> map.

    private List<TalentSearchResult> fetchBrightDataLive(SearchFilters filters, int recordsLimit) {
        if (brightDataApiKey == null || brightDataApiKey.isBlank()) return List.of();
        try {
            JsonNode records = searchBrightData(buildBrightDataSearchBody(filters, recordsLimit));
            if (records == null || !records.isArray() || records.isEmpty()) return List.of();

            Set<String> alreadyCachedForTerm = new HashSet<>(cachedIdsForTerm(filters));

            List<TalentSearchResult> fresh = new ArrayList<>();
            for (JsonNode record : records) {
                if (fresh.size() >= recordsLimit) break;
                String id = textField(record, "id");
                if (id == null || id.isBlank() || alreadyCachedForTerm.contains(id)) continue;
                TalentSearchResult mapped = upsertAndMap(record, id, filters);
                if (mapped != null) fresh.add(mapped);
            }
            return fresh;
        } catch (Exception e) {
            System.err.println("[BrightData] live fetch failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return List.of();
        }
    }

    private Map<String, Object> buildBrightDataSearchBody(SearchFilters filters, int size) {
        List<Map<String, Object>> clauses = new ArrayList<>();

        String titleQuery = buildTitleQuery(filters);
        if (titleQuery != null && !titleQuery.isBlank()) {
            clauses.add(Map.of("name", "position", "operator", "includes", "value", titleQuery));
        }
        if (filters.location() != null && !filters.location().isBlank()) {
            clauses.add(Map.of("name", "city", "operator", "includes", "value", filters.location()));
        }

        return Map.of(
                "filter", Map.of("operator", "and", "filters", clauses),
                "size", size);
    }

    // ─── Search Dataset API — synchronous, no snapshot/polling ───────────────
    // Filter (trigger -> poll snapshot) is built for bulk async jobs and took
    // ~5 minutes even for 5 records — architectural, not tunable via
    // records_limit. Search is Bright Data's documented sub-second real-time
    // lookup endpoint for this same dataset, single request/response — and
    // confirmed near-instant in practice. Small retry margin kept (10s x 4,
    // no delay before the first attempt) purely as a safety net for
    // transient hiccups, not because it's expected to need retries.

    private static final long SEARCH_RETRY_DELAY_MS = 10_000;
    private static final int SEARCH_MAX_ATTEMPTS = 4;

    private JsonNode searchBrightData(Map<String, Object> searchBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(brightDataApiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(searchBody, headers);

        try {
            System.out.println("[BrightData] POST " + brightDataBaseUrl + "/datasets/search/" + brightDataDatasetId
                    + " body=" + objectMapper.writeValueAsString(searchBody));
        } catch (Exception ignored) {}

        long startMs = System.currentTimeMillis();
        for (int attempt = 1; attempt <= SEARCH_MAX_ATTEMPTS; attempt++) {
            long elapsedSec = (System.currentTimeMillis() - startMs) / 1000;
            try {
                ResponseEntity<String> resp = restTemplate.exchange(
                        brightDataBaseUrl + "/datasets/search/" + brightDataDatasetId,
                        HttpMethod.POST, entity, String.class);

                if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                    System.out.println("[BrightData] search succeeded after " + elapsedSec
                            + "s (attempt " + attempt + "/" + SEARCH_MAX_ATTEMPTS + ")");
                    return objectMapper.readTree(resp.getBody()).path("hits");
                }
                System.err.println("[BrightData] search returned HTTP " + resp.getStatusCode()
                        + " at " + elapsedSec + "s, attempt " + attempt + "/" + SEARCH_MAX_ATTEMPTS);
            } catch (Exception e) {
                System.err.println("[BrightData] search failed at " + elapsedSec + "s, attempt "
                        + attempt + "/" + SEARCH_MAX_ATTEMPTS + ": " + e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            if (attempt < SEARCH_MAX_ATTEMPTS) {
                try {
                    Thread.sleep(SEARCH_RETRY_DELAY_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
        }
        long totalElapsedSec = (System.currentTimeMillis() - startMs) / 1000;
        System.err.println("[BrightData] search never succeeded after " + SEARCH_MAX_ATTEMPTS
                + " attempts (" + totalElapsedSec + "s elapsed)");
        return null;
    }

    // ─── Map + persist a Bright Data record ───────────────────────────────────

    private TalentSearchResult upsertAndMap(JsonNode record, String id, SearchFilters filters) {
        try {
            String name           = textField(record, "name");
            String position       = textField(record, "position");
            String city           = textField(record, "city");
            String countryCode    = textField(record, "country_code");
            String about          = textField(record, "about");
            String currentCompany = textField(record, "current_company_name", "current_company");
            String linkedinUrl    = textField(record, "url");
            String avatarUrl      = textField(record, "avatar");
            Boolean defaultAvatar = record.hasNonNull("default_avatar") ? record.get("default_avatar").asBoolean() : null;

            jdbc.update("""
                insert into coresignal_cache
                    (coresignal_id, full_name, job_title, current_company,
                     location_city, location_country, linkedin_url,
                     avatar_url, default_avatar, raw_json, last_searched_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), now())
                on conflict (coresignal_id) do update set
                    full_name        = excluded.full_name,
                    job_title        = excluded.job_title,
                    current_company  = excluded.current_company,
                    location_city    = excluded.location_city,
                    location_country = excluded.location_country,
                    linkedin_url     = excluded.linkedin_url,
                    avatar_url       = excluded.avatar_url,
                    default_avatar   = excluded.default_avatar,
                    raw_json         = excluded.raw_json,
                    cached_at        = now(),
                    last_searched_at = now()
                """,
                id, name, position, currentCompany, city, countryCode, linkedinUrl,
                avatarUrl, defaultAvatar, record.toString());

            List<String> matched = extractMatchedSkills(about != null ? about : "", filters.skills());
            List<String> gaps = filters.skills().stream()
                    .filter(s -> !matched.contains(s))
                    .collect(Collectors.toList());
            int score = Math.min(50 + (matched.size() * 5), 99);

            return new TalentSearchResult(
                    null, name, position, currentCompany, linkedinUrl, null, null,
                    matched, gaps, score, 0,
                    "CORESIGNAL", false, id, avatarUrl, defaultAvatar);
        } catch (Exception e) {
            System.err.println("[BrightData] upsert/map failed for id " + id + ": " + e.getMessage());
            return null;
        }
    }

    private String textField(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode v = node.path(key);
            if (!v.isMissingNode() && !v.isNull() && !v.asText().isBlank()) return v.asText();
        }
        return null;
    }

    // ─── Cache lookups: random pick for display, id set for dedup ────────────

    private List<TalentSearchResult> randomCachedResults(SearchFilters filters, int limit) {
        return queryCache(filters, "order by random() limit " + limit);
    }

    // ID-only lookup for dedup — deliberately does NOT touch last_searched_at
    // (unlike queryCache's row mapper), since this isn't "surfacing" a result,
    // just checking membership.
    private List<String> cachedIdsForTerm(SearchFilters filters) {
        StringBuilder sql = new StringBuilder("select coresignal_id from coresignal_cache");
        List<Object> args = new ArrayList<>();
        appendCacheWhereClause(filters, sql, args);
        return jdbc.queryForList(sql.toString(), String.class, args.toArray());
    }

    private void appendCacheWhereClause(SearchFilters filters, StringBuilder sql, List<Object> args) {
        sql.append(" where cached_at > now() - interval '" + CACHE_DAYS_VALID + " days'");

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
    }

    private List<TalentSearchResult> queryCache(SearchFilters filters, String orderAndLimit) {
        try {
            StringBuilder sql = new StringBuilder(
                    "select coresignal_id, full_name, job_title, current_company," +
                    " linkedin_url, skills, years_experience, avatar_url, default_avatar" +
                    " from coresignal_cache");

            List<Object> args = new ArrayList<>();
            appendCacheWhereClause(filters, sql, args);
            sql.append(" ").append(orderAndLimit);

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
                    rs.getString("coresignal_id"));

                return new TalentSearchResult(
                    null,
                    rs.getString("full_name"),
                    rs.getString("job_title"),
                    rs.getString("current_company"),
                    rs.getString("linkedin_url"),
                    null, null,
                    matched, gaps, score,
                    rs.getInt("years_experience"),
                    "CORESIGNAL", false, rs.getString("coresignal_id"),
                    rs.getString("avatar_url"), (Boolean) rs.getObject("default_avatar"));
            }, args.toArray());

        } catch (Exception e) {
            System.err.println("[BrightData] cache query failed: " + e.getMessage());
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
