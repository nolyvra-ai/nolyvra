package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nolyvra.app.model.ClientRequest;
import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.OutreachRequest;
import com.nolyvra.app.model.PotentialClientResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ClientService {

    private static final Logger log = LoggerFactory.getLogger(ClientService.class);

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final TokenService tokenService;
    private final RestTemplate restTemplate;
    private final String model;
    private final String brightDataApiKey;
    private final String brightDataCompanyDatasetId;
    private final String brightDataBaseUrl;

    public ClientService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${brightdata.api-key:}") String brightDataApiKey,
            @Value("${brightdata.company-dataset-id:gd_l1vijqt9jfj7olije}") String brightDataCompanyDatasetId,
            @Value("${brightdata.base-url:https://api.brightdata.com}") String brightDataBaseUrl) {
        this.jdbc = jdbc;
        this.openAI = openAIClient;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.model = model;
        this.brightDataApiKey = brightDataApiKey;
        this.brightDataCompanyDatasetId = brightDataCompanyDatasetId;
        this.brightDataBaseUrl = brightDataBaseUrl;
        this.restTemplate = new RestTemplate();
    }

    // ─── GET /api/clients ─────────────────────────────────────────────────────

    public List<ClientResponse> getClients(String loginId) {
        String sql = """
                SELECT c.id, c.login_id, c.company_name, c.industry, c.company_size, c.location,
                       c.contact_person, c.contact_email, c.contact_title, c.linkedin_url, c.notes,
                       c.last_funding_event, c.last_funding_amount, c.created_at,
                       COUNT(DISTINCT j.id) FILTER (WHERE lower(j.status) = 'active') AS active_job_count,
                       COUNT(DISTINCT cand.id) FILTER (WHERE cand.stage = 'Selected') AS filled_job_count,
                       COUNT(DISTINCT j.id) AS total_job_count
                FROM clients c
                LEFT JOIN jobs j ON lower(j.company) = lower(c.company_name) AND j.login_id = c.login_id
                LEFT JOIN candidates cand ON cand.job_id = j.id
                WHERE c.login_id = ?
                GROUP BY c.id
                ORDER BY c.created_at DESC
                """;

        return jdbc.query(sql, (rs, i) -> {
            String companyName = rs.getString("company_name");
            List<ClientResponse.JobSummary> recentJobs = getClientJobs(companyName, loginId);
            List<ClientResponse.FeeTotal> totalFee = getClientFeeTotals(companyName, loginId);
            var ts = rs.getTimestamp("created_at");
            return new ClientResponse(
                    rs.getLong("id"),
                    rs.getString("login_id"),
                    companyName,
                    rs.getString("industry"),
                    rs.getString("company_size"),
                    rs.getString("location"),
                    rs.getString("contact_person"),
                    rs.getString("contact_email"),
                    rs.getString("contact_title"),
                    rs.getString("linkedin_url"),
                    rs.getString("notes"),
                    rs.getString("last_funding_event"),
                    rs.getString("last_funding_amount"),
                    ts != null ? ts.toInstant() : null,
                    rs.getInt("active_job_count"),
                    rs.getInt("filled_job_count"),
                    rs.getInt("total_job_count"),
                    recentJobs,
                    totalFee);
        }, loginId);
    }

    public ClientResponse getClientForHubSpot(Long id, String loginId) {
        return jdbc.query("""
                SELECT id, login_id, company_name, industry, company_size, location,
                       contact_person, contact_email, contact_title, linkedin_url, notes,
                       last_funding_event, last_funding_amount, created_at
                FROM clients
                WHERE id = ? AND login_id = ?
                """, (rs, i) -> {
            var ts = rs.getTimestamp("created_at");
            return new ClientResponse(
                    rs.getLong("id"), rs.getString("login_id"), rs.getString("company_name"),
                    rs.getString("industry"), rs.getString("company_size"), rs.getString("location"),
                    rs.getString("contact_person"), rs.getString("contact_email"),
                    rs.getString("contact_title"), rs.getString("linkedin_url"), rs.getString("notes"),
                    rs.getString("last_funding_event"), rs.getString("last_funding_amount"),
                    ts != null ? ts.toInstant() : null, 0, 0, 0, List.of(), List.of());
        }, id, loginId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));
    }

    // ─── Helper: fetch up to 5 Active/Fulfilling jobs (title + age + status + fee) for a company

    public List<ClientResponse.JobSummary> getClientJobs(String companyName, String loginId) {
        return jdbc.query("""
                SELECT title, status, salary, currency, fee_percentage,
                       EXTRACT(DAY FROM now() - created_at)::int AS days_old
                FROM jobs
                WHERE login_id = ? AND lower(company) = lower(?)
                  AND lower(status) IN ('active', 'fulfilling')
                ORDER BY created_at DESC LIMIT 5
                """,
                (rs, i) -> mapJobSummary(rs),
                loginId, companyName);
    }

    // ─── Helper: full (uncapped) job list for a company — used by the client detail view

    public List<ClientResponse.JobSummary> getAllClientJobs(String companyName, String loginId) {
        return jdbc.query("""
                SELECT title, status, salary, currency, fee_percentage,
                       EXTRACT(DAY FROM now() - created_at)::int AS days_old
                FROM jobs
                WHERE login_id = ? AND lower(company) = lower(?)
                ORDER BY created_at DESC
                """,
                (rs, i) -> mapJobSummary(rs),
                loginId, companyName);
    }

    private ClientResponse.JobSummary mapJobSummary(java.sql.ResultSet rs) throws java.sql.SQLException {
        BigDecimal salary = rs.getBigDecimal("salary");
        BigDecimal feePercentage = rs.getBigDecimal("fee_percentage");
        return new ClientResponse.JobSummary(
                rs.getString("title"),
                rs.getInt("days_old"),
                rs.getString("status"),
                salary,
                rs.getString("currency"),
                feePercentage,
                computeEstimatedFee(salary, feePercentage));
    }

    private static BigDecimal computeEstimatedFee(BigDecimal salary, BigDecimal feePercentage) {
        if (salary == null || feePercentage == null) return null;
        return salary.multiply(feePercentage)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    // ─── Helper: total estimated fee across Active/Fulfilling jobs, grouped by currency ──

    public List<ClientResponse.FeeTotal> getClientFeeTotals(String companyName, String loginId) {
        return jdbc.query("""
                SELECT currency, SUM(salary * fee_percentage / 100) AS total
                FROM jobs
                WHERE login_id = ? AND lower(company) = lower(?)
                  AND lower(status) IN ('active', 'fulfilling')
                  AND salary IS NOT NULL AND fee_percentage IS NOT NULL
                GROUP BY currency
                ORDER BY currency
                """,
                (rs, i) -> new ClientResponse.FeeTotal(
                        rs.getString("currency"),
                        rs.getBigDecimal("total").setScale(2, RoundingMode.HALF_UP)),
                loginId, companyName);
    }

    // ─── PUT /api/clients/{id} ────────────────────────────────────────────────

    public ClientResponse updateClient(Long id, ClientRequest req, String loginId) {
        int updated = jdbc.update("""
                UPDATE clients SET
                    company_name = ?, industry = ?, company_size = ?,
                    location = ?, contact_person = ?, contact_email = ?,
                    contact_title = ?, linkedin_url = ?, notes = ?,
                    updated_at = now()
                WHERE id = ? AND login_id = ?
                """,
                req.companyName(), req.industry(), req.companySize(), req.location(),
                req.contactPerson(), req.contactEmail(), req.contactTitle(),
                req.linkedinUrl(), req.notes(), id, loginId);
        if (updated == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found");

        String sql = """
                SELECT c.id, c.login_id, c.company_name, c.industry, c.company_size, c.location,
                       c.contact_person, c.contact_email, c.contact_title, c.linkedin_url, c.notes,
                       c.last_funding_event, c.last_funding_amount, c.created_at,
                       COUNT(DISTINCT j.id) FILTER (WHERE lower(j.status) = 'active') AS active_job_count,
                       COUNT(DISTINCT cand.id) FILTER (WHERE cand.stage = 'Selected') AS filled_job_count,
                       COUNT(DISTINCT j.id) AS total_job_count
                FROM clients c
                LEFT JOIN jobs j ON lower(j.company) = lower(c.company_name) AND j.login_id = c.login_id
                LEFT JOIN candidates cand ON cand.job_id = j.id
                WHERE c.id = ? AND c.login_id = ?
                GROUP BY c.id
                """;
        return jdbc.query(sql, (rs, i) -> {
            String companyName = rs.getString("company_name");
            List<ClientResponse.JobSummary> recentJobs = getClientJobs(companyName, loginId);
            List<ClientResponse.FeeTotal> totalFee = getClientFeeTotals(companyName, loginId);
            var ts = rs.getTimestamp("created_at");
            return new ClientResponse(
                    rs.getLong("id"), rs.getString("login_id"), companyName,
                    rs.getString("industry"), rs.getString("company_size"), rs.getString("location"),
                    rs.getString("contact_person"), rs.getString("contact_email"), rs.getString("contact_title"),
                    rs.getString("linkedin_url"), rs.getString("notes"),
                    rs.getString("last_funding_event"), rs.getString("last_funding_amount"),
                    ts != null ? ts.toInstant() : null,
                    rs.getInt("active_job_count"), rs.getInt("filled_job_count"), rs.getInt("total_job_count"),
                    recentJobs, totalFee);
        }, id, loginId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));
    }

    // ─── POST /api/clients ────────────────────────────────────────────────────

    public ClientResponse createClient(ClientRequest req, String loginId) {
        Long id = jdbc.queryForObject("""
                INSERT INTO clients (login_id, company_name, industry, company_size, location,
                    contact_person, contact_email, contact_title, linkedin_url, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                loginId, req.companyName(), req.industry(), req.companySize(), req.location(),
                req.contactPerson(), req.contactEmail(), req.contactTitle(),
                req.linkedinUrl(), req.notes());

        return new ClientResponse(
                id != null ? id : 0L, loginId, req.companyName(), req.industry(),
                req.companySize(), req.location(), req.contactPerson(), req.contactEmail(),
                req.contactTitle(), req.linkedinUrl(), req.notes(),
                null, null, Instant.now(), 0, 0, 0, List.of(), List.of());
    }

    // ─── GET /api/clients/{id}/jobs ────────────────────────────────────────────
    // Full, uncapped job list with fees for a single client — used by the client detail view.

    public List<ClientResponse.JobSummary> getClientJobsById(Long clientId, String loginId) {
        String companyName = jdbc.query(
                "SELECT company_name FROM clients WHERE id = ? AND login_id = ?",
                (rs, i) -> rs.getString("company_name"), clientId, loginId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));
        return getAllClientJobs(companyName, loginId);
    }

    private static final int LEAD_BATCH_SIZE = 5;
    private static final long POLL_DELAY_MS = 180_000;
    private static final int POLL_MAX_ATTEMPTS = 5;

    // ─── GET /api/clients/potential ───────────────────────────────────────────

    public List<PotentialClientResponse> getPotentialClients(
            String loginId, String industry, String place,
            String companySize, String keyword) {
        log.info("[ClientSearch] Params — industry='{}' place='{}' companySize='{}' keyword='{}'",
                industry, place, companySize, keyword);
        try {
            return fetchLeadCompanies(industry, place, companySize, keyword);
        } catch (Exception e) {
            log.error("[ClientSearch] Unhandled exception in fetchLeadCompanies: {}", e.getMessage(), e);
            return List.of();
        }
    }

    // ─── GET /api/clients/potential/load-more ──────────────────────────────────
    // Stateless — identical operation to getPotentialClients, repeated on each click.

    public List<PotentialClientResponse> loadMoreClients(
            String loginId, String industry, String place,
            String companySize, String keyword) {
        try {
            return fetchLeadCompanies(industry, place, companySize, keyword);
        } catch (Exception e) {
            log.error("[ClientSearch] Unhandled exception in loadMoreClients: {}", e.getMessage(), e);
            return List.of();
        }
    }

    // ─── Shared 5-cached + 5-fresh core ────────────────────────────────────────

    private List<PotentialClientResponse> fetchLeadCompanies(
            String industry, String place, String companySize, String keyword) {
        List<PotentialClientResponse> cached =
                randomCachedCompanies(industry, place, companySize, keyword, LEAD_BATCH_SIZE);
        // Dedupe fresh Bright Data hits only against the specific records just
        // picked for the cached half of THIS response — not the entire history
        // of everything ever cached for this term. Bright Data's Search isn't
        // randomized/paginated, so it returns the same deterministic top-N
        // matches every call; deduping against the full historical cache meant
        // the fresh half silently returned 0 results as soon as those matches
        // had been cached once, on any prior search.
        Set<String> justShownFromCache = cached.stream()
                .map(PotentialClientResponse::externalId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<PotentialClientResponse> combined = new ArrayList<>(cached);
        combined.addAll(fetchBrightDataCompaniesLive(industry, place, LEAD_BATCH_SIZE, justShownFromCache));
        return combined;
    }

    private void appendLeadCompanyWhereClause(
            String industry, String place, String companySize, String keyword,
            StringBuilder sql, List<Object> args) {
        sql.append(" where sector = 'real_estate' and is_active = true");
        if (isPresent(industry)) {
            sql.append(" and data->>'industry' ilike ?");
            args.add("%" + industry + "%");
        }
        if (isPresent(place)) {
            sql.append(" and (data->>'location_hq_city' ilike ? or data->>'location_hq_country' ilike ? or region ilike ?)");
            args.add("%" + place + "%");
            args.add("%" + place + "%");
            args.add("%" + place + "%");
        }
        if (isPresent(companySize)) {
            List<String> ranges = mapSizeToRanges(companySize);
            if (!ranges.isEmpty()) {
                List<String> clauses = new ArrayList<>();
                for (String r : ranges) {
                    clauses.add("data->>'size_range' = ?");
                    args.add(r);
                }
                sql.append(" and (").append(String.join(" or ", clauses)).append(")");
            }
        }
        if (isPresent(keyword)) {
            sql.append(" and data->>'name' ilike ?");
            args.add("%" + keyword + "%");
        }
    }

    private List<PotentialClientResponse> randomCachedCompanies(
            String industry, String place, String companySize, String keyword, int limit) {
        StringBuilder sql = new StringBuilder("select external_id, data from lead_companies");
        List<Object> args = new ArrayList<>();
        appendLeadCompanyWhereClause(industry, place, companySize, keyword, sql, args);
        sql.append(" order by random() limit ").append(limit);

        List<PotentialClientResponse> results = jdbc.query(sql.toString(), (rs, i) -> {
            String externalId = rs.getString("external_id");
            try {
                JsonNode data = objectMapper.readTree(rs.getString("data"));
                jdbc.update("update lead_companies set fetch_count = fetch_count + 1, last_fetched_at = now() where external_id = ?",
                        externalId);
                return mapStoredDataToPotentialClient(data, externalId);
            } catch (Exception e) {
                log.error("[ClientSearch] failed to parse cached row {}: {}", externalId, e.getMessage());
                return null;
            }
        }, args.toArray());
        results.removeIf(Objects::isNull);
        return results;
    }

    private List<String> mapSizeToRanges(String size) {
        return switch (size.toLowerCase()) {
            case "small"      -> List.of("1-10", "11-50");
            case "medium"     -> List.of("51-100", "51-200", "201-500");
            case "large"      -> List.of("501-1000", "1001-5000");
            case "enterprise" -> List.of("5001-10000", "10001+");
            default           -> List.of();
        };
    }

    // Confirmed-real num_employees bucket values for this Bright Data dataset,
    // ascending (from the user's working curl example — these are NOT the same
    // strings mapSizeToRanges above uses for the DB cache side, which reflects
    // whatever is actually stored in lead_companies.data).
    private static final List<String> BRIGHTDATA_SIZE_BUCKETS = List.of(
            "11-50", "51-100", "101-250", "251-500", "501-1000", "1001-5000", "5001-10000", "10001+");

    // Each dropdown option maps to "this bucket and everything larger" via the
    // "in" operator (confirmed working — "!=" against a single bucket failed
    // the snapshot job outright).
    private List<String> mapSizeToBrightDataBuckets(String size) {
        int fromIndex = switch (size.toLowerCase()) {
            case "small"      -> 0; // 11-50 and up — excludes only the 1-10 micro bucket
            case "medium"     -> 1; // 51-100 and up
            case "large"      -> 3; // 251-500 and up
            case "enterprise" -> 5; // 1001-5000 and up
            default           -> -1;
        };
        return fromIndex < 0 ? List.of() : BRIGHTDATA_SIZE_BUCKETS.subList(fromIndex, BRIGHTDATA_SIZE_BUCKETS.size());
    }

    private boolean isPresent(String val) {
        return val != null && !val.isBlank();
    }

    // ─── Bright Data live call: Search API ────────────────────────────────────
    // gd_l1vikfnt1wgvvqz95w is one of the three dataset IDs Bright Data itself
    // confirmed as Search-enabled on this account (from the earlier "dataset_id
    // must be one of [...]" 400) — same fast, synchronous, no-snapshot pattern
    // as candidates. Field mapping (mapBrightDataCompanyToStoredShape) still
    // reflects the old Crunchbase dataset's schema and needs rebuilding once a
    // real response is captured — logging the full raw response here for that.

    private List<PotentialClientResponse> fetchBrightDataCompaniesLive(
            String industry, String place, int limit, Set<String> excludeIds) {
        if (brightDataApiKey == null || brightDataApiKey.isBlank()) return List.of();
        try {
            JsonNode records = searchBrightDataCompanies(buildCompanySearchBody(industry, place, limit));
            if (records == null || !records.isArray() || records.isEmpty()) return List.of();

            List<PotentialClientResponse> fresh = new ArrayList<>();
            for (JsonNode record : records) {
                if (fresh.size() >= limit) break;
                String rawId = textField(record, "id");
                if (rawId == null || rawId.isBlank()) continue;
                String externalId = "BD-" + rawId;
                if (externalId.length() > 50) externalId = externalId.substring(0, 50);
                if (excludeIds.contains(externalId)) continue;

                ObjectNode mapped = mapBrightDataCompanyToStoredShape(record);
                upsertLeadCompany(externalId, mapped);
                fresh.add(mapStoredDataToPotentialClient(mapped, externalId));
            }
            log.info("[ClientSearch] kept {} of {} raw hit(s) after cap/dedup (limit={})",
                    fresh.size(), records.size(), limit);
            return fresh;
        } catch (Exception e) {
            log.error("[ClientSearch] live fetch failed: {}", e.getMessage(), e);
            return List.of();
        }
    }

    // Clause rules per the user's confirmed dashboard-generated filter for this
    // dataset: industries includes <industry>, place matched with an OR across
    // three possible location field names (locations / formatted_locations /
    // headquarters — hedging since it's unconfirmed which one this dataset
    // actually populates). companySize and keyword's buying-signal clause are
    // deliberately NOT sent yet — "num_employees" and "leadership_hire" were
    // Crunchbase-specific field names with no confirmed equivalent here; adding
    // them back is a follow-up once we see a real response.
    private Map<String, Object> buildCompanySearchBody(String industry, String place, int size) {
        List<Map<String, Object>> clauses = new ArrayList<>();
        if (isPresent(industry)) clauses.add(Map.of("name", "industries", "operator", "includes", "value", industry));
        if (isPresent(place)) {
            clauses.add(Map.of("operator", "or", "filters", List.of(
                    Map.of("name", "locations", "operator", "includes", "value", place),
                    Map.of("name", "formatted_locations", "operator", "includes", "value", place),
                    Map.of("name", "headquarters", "operator", "includes", "value", place))));
        }

        // "records_limit" is rejected outright on this endpoint ("records_limit"
        // is not allowed") — confirmed Filter-API-only. "size" is the correct
        // (and only) param name for Search.
        return Map.of(
                "filter", Map.of("operator", "and", "filters", clauses),
                "size", size);
    }

    private JsonNode searchBrightDataCompanies(Map<String, Object> searchBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(brightDataApiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(searchBody, headers);

        try {
            log.info("[ClientSearch] POST {}/datasets/search/{} body={}",
                    brightDataBaseUrl, brightDataCompanyDatasetId, objectMapper.writeValueAsString(searchBody));
        } catch (Exception ignored) {}

        for (int attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
            try {
                ResponseEntity<String> resp = restTemplate.exchange(
                        brightDataBaseUrl + "/datasets/search/" + brightDataCompanyDatasetId,
                        HttpMethod.POST, entity, String.class);
                if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                    JsonNode hits = objectMapper.readTree(resp.getBody()).path("hits");
                    log.info("[ClientSearch] search succeeded (attempt {}/{}) — {} raw hit(s) returned by Bright Data",
                            attempt, POLL_MAX_ATTEMPTS, hits.isArray() ? hits.size() : -1);
                    return hits;
                }
                log.warn("[ClientSearch] Bright Data search returned HTTP {} (attempt {}/{})",
                        resp.getStatusCode(), attempt, POLL_MAX_ATTEMPTS);
            } catch (Exception e) {
                log.warn("[ClientSearch] Bright Data search failed (attempt {}/{}): {}",
                        attempt, POLL_MAX_ATTEMPTS, e.getMessage());
            }
            if (attempt < POLL_MAX_ATTEMPTS) {
                try {
                    Thread.sleep(POLL_DELAY_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
        }
        return null;
    }

    // ─── Reshape a Bright Data LinkedIn Company record into the CoreSignal- ───
    // shaped structure lead_companies.data already documents. Field names
    // confirmed against a real captured response for gd_l1vikfnt1wgvvqz95w
    // (e.g. "MY AUSTRALIAN PROPERTY" — id, name, industries, company_size,
    // headquarters, country_code, unformatted_about, organization_type,
    // website, url, employees[], updates[]). This dataset has no Crunchbase-
    // style funding/job-postings data — those stay null, which the schema
    // already treats as independently nullable.

    private ObjectNode mapBrightDataCompanyToStoredShape(JsonNode record) {
        ObjectNode out = objectMapper.createObjectNode();
        String companyName = textField(record, "name");
        out.put("name", companyName);

        // "industries" is a plain string on this dataset (unlike Crunchbase's
        // array of {id, value} objects).
        String industry = textField(record, "industries");
        if (industry != null) out.put("industry", industry); else out.putNull("industry");

        // e.g. "2-10 employees" — kept as-is, no bucket normalisation since the
        // full vocabulary isn't confirmed.
        String sizeRange = textField(record, "company_size");
        if (sizeRange != null) out.put("size_range", sizeRange); else out.putNull("size_range");
        if (record.hasNonNull("employees_in_linkedin")) {
            out.put("size_employees_count", record.path("employees_in_linkedin").asInt());
        } else {
            out.putNull("size_employees_count");
        }

        // "headquarters" is already a formatted "City, State" string; no separate
        // city/country split is offered beyond the ISO country_code.
        String headquarters = textField(record, "headquarters");
        String countryCode = textField(record, "country_code");
        if (headquarters != null) out.put("location_hq_city", headquarters); else out.putNull("location_hq_city");
        if (countryCode != null) out.put("location_hq_country", countryCode); else out.putNull("location_hq_country");

        String description = textField(record, "unformatted_about", "about", "description");
        if (description != null) out.put("description", description.strip()); else out.putNull("description");

        // Not present in this dataset's schema.
        out.putNull("founded");

        String orgType = textField(record, "organization_type");
        out.put("type", orgType != null ? orgType : "Privately Held");

        String website = textField(record, "website");
        if (website != null) out.put("websites_main", website); else out.putNull("websites_main");

        // "url" is the LinkedIn company page itself on this dataset (no separate
        // social_media_links array like Crunchbase).
        String linkedinUrl = textField(record, "url");
        if (linkedinUrl != null) out.put("websites_linkedin", linkedinUrl); else out.putNull("websites_linkedin");

        // Not present in this dataset.
        out.putNull("active_job_postings_count");
        out.set("employees_count_change", objectMapper.createObjectNode().putNull("change_yearly_percentage"));
        out.set("active_job_postings_count_change", objectMapper.createObjectNode().putNull("change_monthly_percentage"));
        out.putNull("last_funding_round");

        // "employees[]" only exposes {img, link, title} for a handful of profiles
        // shown on the company page — "title" is often the person's name, but can
        // also be a private-profile placeholder ("LinkedIn Member") or just repeat
        // the company name; skip both. No separate job-title field is available.
        ArrayNode executives = objectMapper.createArrayNode();
        JsonNode employees = record.path("employees");
        if (employees.isArray()) {
            int count = 0;
            for (JsonNode emp : employees) {
                if (count >= 5) break;
                String label = emp.path("title").asText("");
                if (!label.isBlank() && !label.equalsIgnoreCase("LinkedIn Member")
                        && (companyName == null || !label.equalsIgnoreCase(companyName))) {
                    ObjectNode exec = objectMapper.createObjectNode();
                    exec.put("member_full_name", label);
                    exec.putNull("member_position_title");
                    executives.add(exec);
                    count++;
                }
            }
        }
        out.set("key_executives", executives);

        // No specialities-style field on this dataset.
        out.set("specialities", objectMapper.createArrayNode());

        // "updates[]" is this company's recent LinkedIn post feed — closest
        // analog to Crunchbase's news_articles[]. "title" in each entry just
        // repeats the company name, so the headline is derived from the post
        // body ("text") instead, truncated for display.
        ArrayNode newsArticles = objectMapper.createArrayNode();
        JsonNode updates = record.path("updates");
        if (updates.isArray()) {
            for (JsonNode u : updates) {
                String text = u.path("text").asText("");
                if (!text.isBlank()) {
                    String headline = text.length() > 120 ? text.substring(0, 120).strip() + "…" : text.strip();
                    ObjectNode article = objectMapper.createObjectNode();
                    article.put("headline", headline);
                    article.put("date", u.path("date").asText(null));
                    newsArticles.add(article);
                }
            }
        }
        out.set("news_articles", newsArticles);

        return out;
    }

    private String textField(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode v = node.path(key);
            if (!v.isMissingNode() && !v.isNull() && !v.asText().isBlank()) return v.asText();
        }
        return null;
    }

    private void upsertLeadCompany(String externalId, ObjectNode data) {
        try {
            String city = data.path("location_hq_city").asText(null);
            String country = data.path("location_hq_country").asText(null);
            String region = isPresent(city)
                    ? (isPresent(country) ? city + ", " + country : city)
                    : country;
            jdbc.update("""
                insert into lead_companies (external_id, sector, region, data, source)
                values (?, 'real_estate', ?, CAST(? AS jsonb), 'brightdata')
                on conflict (external_id) do update set
                    region     = excluded.region,
                    data       = excluded.data,
                    updated_at = now()
                """,
                externalId, region, objectMapper.writeValueAsString(data));
        } catch (Exception e) {
            log.error("[ClientSearch] upsert failed for {}: {}", externalId, e.getMessage());
        }
    }

    // ─── Map stored/mapped CoreSignal-shaped JSON -> PotentialClientResponse ──
    // Reused for both cached rows (read from lead_companies.data) and freshly-
    // mapped Bright Data records — same scoring/signal logic either way.

    private PotentialClientResponse mapStoredDataToPotentialClient(JsonNode c, String externalId) {
        String companyName   = c.path("name").asText("Unknown");
        String industry      = c.path("industry").asText("");
        String sizeRange     = c.path("size_range").asText("");
        String city          = c.path("location_hq_city").asText("");
        String country       = c.path("location_hq_country").asText("");
        String location      = city.isBlank() ? country : city + ", " + country;

        int openRoles        = c.path("active_job_postings_count").asInt(0);
        int totalEmployees   = c.path("size_employees_count").asInt(0);
        String description   = c.path("description").asText("");
        String websiteUrl    = c.path("websites_main").asText("");
        String linkedinUrl   = c.path("websites_linkedin").asText("");
        String foundedYear   = c.path("founded").asText("");
        String companyType   = c.path("type").asText("");

        double growthPct         = c.path("employees_count_change")
            .path("change_yearly_percentage").asDouble(0);
        double postingsGrowthPct = c.path("active_job_postings_count_change")
            .path("change_monthly_percentage").asDouble(0);

        JsonNode funding = c.path("last_funding_round");
        String fundingEvent = null;
        if (!funding.isMissingNode() && !funding.isNull()) {
            String type     = funding.path("type").asText("");
            long amount     = funding.path("amount_raised").asLong(0);
            String currency = funding.path("amount_raised_currency").asText("USD");
            String date     = funding.path("announced_date").asText("");
            if (amount > 0) {
                long amountM = amount / 1_000_000;
                fundingEvent = type + " — " + currency + " " +
                    (amountM > 0 ? amountM + "M" : amount) + " raised" +
                    (date.isBlank() ? "" : " (" + date.substring(0, 7) + ")");
            }
        }

        List<String> signals = new ArrayList<>();
        if (fundingEvent != null) signals.add("💰 " + fundingEvent);
        if (postingsGrowthPct > 30)
            signals.add("📋 +" + Math.round(postingsGrowthPct) + "% job postings this month");
        else if (openRoles > 0)
            signals.add("📋 " + openRoles + " active job posting" + (openRoles > 1 ? "s" : ""));
        if (growthPct > 15)
            signals.add("↗ +" + Math.round(growthPct) + "% team growth");

        JsonNode news = c.path("news_articles");
        if (news.isArray() && news.size() > 0) {
            String headline = news.get(0).path("headline").asText("");
            if (!headline.isBlank()) signals.add("📰 " + headline);
        }

        if (signals.isEmpty()) signals.add("📋 " + openRoles + " open roles");

        String hiringSignal;
        if (fundingEvent != null && postingsGrowthPct > 50) hiringSignal = "Very High";
        else if (fundingEvent != null || postingsGrowthPct > 50 || growthPct > 30) hiringSignal = "High";
        else hiringSignal = "Medium";

        int matchScore = 50;
        if (fundingEvent != null) matchScore += 20;
        if (postingsGrowthPct > 50) matchScore += 15;
        if (growthPct > 20) matchScore += 10;
        matchScore += Math.min(openRoles * 2, 15);
        matchScore = Math.min(matchScore, 98);

        List<PotentialClientResponse.DecisionMaker> decisionMakers = new ArrayList<>();
        JsonNode executives = c.path("key_executives");
        if (executives.isArray()) {
            for (int i = 0; i < executives.size(); i++) {
                JsonNode exec = executives.get(i);
                String name  = exec.path("member_full_name").asText("");
                String title = exec.path("member_position_title").asText("");
                if (!name.isBlank()) {
                    decisionMakers.add(new PotentialClientResponse.DecisionMaker(name, title));
                }
            }
        }

        List<String> specialties = new ArrayList<>();
        JsonNode specs = c.path("specialities");
        if (specs.isArray()) {
            for (JsonNode s : specs) {
                String spec = s.asText("");
                if (!spec.isBlank()) specialties.add(spec);
            }
        }

        List<PotentialClientResponse.NewsArticle> newsArticles = new ArrayList<>();
        if (news.isArray()) {
            for (JsonNode article : news) {
                String headline = article.path("headline").asText("");
                String date     = article.path("date").asText("");
                if (!headline.isBlank())
                    newsArticles.add(new PotentialClientResponse.NewsArticle(headline, date));
            }
        }

        return new PotentialClientResponse(
            externalId, companyName, industry, sizeRange, location,
            fundingEvent != null ? fundingEvent : hiringSignal + " hiring signal",
            signals, openRoles, matchScore, (int) Math.round(growthPct),
            decisionMakers,
            description, websiteUrl, linkedinUrl, foundedYear, companyType,
            specialties, newsArticles, totalEmployees, postingsGrowthPct,
            city, country);
    }

    // ─── POST /api/clients/outreach ───────────────────────────────────────────

    public String generateOutreachMessage(String loginId, OutreachRequest req) {
        if (!tokenService.deductToken(loginId))
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");

        String industry = isPresent(req.industry()) ? req.industry() : "their industry";
        String place = isPresent(req.place()) ? req.place() : "their region";
        String keyword = isPresent(req.keyword()) ? req.keyword() : "hiring";
        String signals = isPresent(req.recentSignals()) ? req.recentSignals() : "recent growth and expansion";
        String agencyName = getAgencyName(loginId);

        String systemPrompt = req.bulk()
                ? """
                  You are an expert B2B sales copywriter specialising in recruitment agency outreach.
                  Write a single concise cold outreach email (150–200 words) that will be sent, unchanged, to
                  MULTIPLE different hiring decision-makers across similar companies — it must NOT name any
                  specific company, since the exact same body is reused for every recipient.
                  Tone: professional, warm, consultative — never salesy.
                  Structure: 1 opening hook relevant to the shared industry/location/hiring context given below,
                  2 lines on how the sending agency (name given below) can help teams like theirs specifically
                  (grounded in that industry, location and hiring context — never generic boilerplate), 1 clear CTA.
                  Always refer to the sender by the exact agency name given below — never invent or substitute a
                  different agency name.
                  Start the email with the literal greeting "Hi {}," using the literal characters { and } exactly
                  as shown — this is a merge-field placeholder for each recipient's name and must not be replaced,
                  translated, described, or removed.
                  Return only the email body — no subject line, no markdown, no sign-off.
                  """
                : """
                  You are an expert B2B sales copywriter specialising in recruitment agency outreach.
                  Write a concise, personalised cold outreach email (150–200 words) to a hiring decision-maker.
                  Tone: professional, warm, consultative — never salesy.
                  Structure: 1 opening hook tied to their recent signal, 2 lines on how the sending agency (name
                  given below) can help THIS company specifically — grounded in their industry, location and
                  hiring context given below (never generic boilerplate), 1 clear CTA.
                  Always refer to the sender by the exact agency name given below — never invent or substitute a
                  different agency name.
                  Return only the email body — no subject line, no markdown, no sign-off.
                  """;

        String userPrompt = req.bulk()
                ? String.format("""
                        Shared industry: %s
                        Shared location: %s
                        Search context / hiring keyword: %s
                        Sender agency name: %s
                        """,
                        industry, place, keyword, agencyName)
                : String.format("""
                        Client company: %s
                        Contact name: %s
                        Industry: %s
                        Location: %s
                        Search context / hiring keyword: %s
                        Recent hiring signals: %s
                        Sender agency name: %s
                        """,
                        req.clientName(),
                        isPresent(req.contactName()) ? req.contactName() : "Hiring Manager",
                        industry, place, keyword, signals, agencyName);

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage(userPrompt)
                .temperature(0.7)
                .build();

        try {
            return openAI.chat().completions().create(params)
                    .choices().getFirst().message().content()
                    .orElse("Unable to generate outreach message at this time.");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to generate outreach message: " + e.getMessage());
        }
    }

    private String getAgencyName(String loginId) {
        List<String> rows = jdbc.query(
                "SELECT company FROM login WHERE id = ?",
                (rs, rowNum) -> rs.getString("company"),
                loginId);
        String company = rows.isEmpty() ? null : rows.get(0);
        return isPresent(company) ? company : "Nolyvra";
    }
}
