package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@Service
public class ClientService {

    private static final Logger log = LoggerFactory.getLogger(ClientService.class);

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final TokenService tokenService;
    private final RestTemplate restTemplate;
    private final String model;
    private final String coreSignalApiKey;
    private final String coreSignalBaseUrl;

    public ClientService(
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
        this.model = model;
        this.coreSignalApiKey = coreSignalApiKey;
        this.coreSignalBaseUrl = coreSignalBaseUrl;
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

    // ─── GET /api/clients/potential ───────────────────────────────────────────

    public List<PotentialClientResponse> getPotentialClients(
            String loginId, String industry, String country,
            String companySize, String keyword) {
        if (coreSignalApiKey == null || coreSignalApiKey.isBlank()) {
            log.warn("[ClientSearch] CoreSignal API key is not configured — returning empty");
            return List.of();
        }
        log.info("[ClientSearch] Params — industry='{}' country='{}' companySize='{}' keyword='{}'",
                industry, country, companySize, keyword);
        try {
            return fetchFromCoreSignal(loginId, industry, country, companySize, keyword);
        } catch (Exception e) {
            log.error("[ClientSearch] Unhandled exception in fetchFromCoreSignal: {}", e.getMessage(), e);
            return List.of();
        }
    }

    // ─── CoreSignal: search + collect company profiles ────────────────────────

    private List<PotentialClientResponse> fetchFromCoreSignal(
            String loginId, String industry, String country,
            String companySize, String keyword) throws Exception {

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", coreSignalApiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Build ES DSL query with filters applied at source — never fetch more than 4 IDs
        List<Map<String, Object>> mustClauses = new ArrayList<>();
        if (isPresent(country))     mustClauses.add(Map.of("match", Map.of("location_hq_country", country)));
        if (isPresent(industry))    mustClauses.add(Map.of("match", Map.of("industry", industry)));
        if (isPresent(companySize)) {
            List<String> ranges = mapSizeToRanges(companySize);
            if (!ranges.isEmpty()) mustClauses.add(Map.of("terms", Map.of("size_range", ranges)));
        }
        if (isPresent(keyword))     mustClauses.add(Map.of("match", Map.of("name", keyword)));

        Map<String, Object> queryBody = mustClauses.isEmpty()
            ? Map.of("query", Map.of("match_all", Map.of()))
            : Map.of("query", Map.of("bool", Map.of("must", mustClauses)));

        String searchUrl = coreSignalBaseUrl + "/company_clean/search/es_dsl";
        log.info("[ClientSearch] POST {} body={}", searchUrl, objectMapper.writeValueAsString(queryBody));

        HttpEntity<Map<String, Object>> searchEntity = new HttpEntity<>(queryBody, headers);
        ResponseEntity<String> searchResp = restTemplate.exchange(
            searchUrl, HttpMethod.POST, searchEntity, String.class);

        String rawBody = searchResp.getBody();
        log.info("[ClientSearch] Search status={} bodyLength={}",
                searchResp.getStatusCode(), rawBody != null ? rawBody.length() : 0);

        if (!searchResp.getStatusCode().is2xxSuccessful() || rawBody == null) {
            log.warn("[ClientSearch] Non-2xx or empty body — aborting");
            return List.of();
        }

        JsonNode idsNode = objectMapper.readTree(rawBody);
        int count = idsNode.isArray() ? Math.min(idsNode.size(), 4) : 0;
        log.info("[ClientSearch] IDs returned: {} (collecting {})", idsNode.isArray() ? idsNode.size() : 0, count);
        if (count == 0) return List.of();

        List<Integer> ids = new ArrayList<>();
        for (int i = 0; i < count; i++) ids.add(idsNode.get(i).asInt());
        log.info("[ClientSearch] Collecting IDs: {}", ids);

        List<PotentialClientResponse> results = new ArrayList<>();
        for (int id : ids) {
            PotentialClientResponse pc = collectCompany(id, headers);
            if (pc != null) results.add(pc);
        }

        results.sort(Comparator.comparingInt(PotentialClientResponse::matchScore).reversed());
        return results;
    }

    private List<String> mapSizeToRanges(String size) {
        return switch (size.toLowerCase()) {
            case "small"      -> List.of("1-10 employees", "11-50 employees");
            case "medium"     -> List.of("51-200 employees", "201-500 employees");
            case "large"      -> List.of("501-1000 employees", "1001-5000 employees");
            case "enterprise" -> List.of("5001-10000 employees", "10001+ employees");
            default           -> List.of();
        };
    }

    private boolean isPresent(String val) {
        return val != null && !val.isBlank();
    }

    // ─── Collect a single company profile by ID ───────────────────────────────

    private PotentialClientResponse collectCompany(int id, HttpHeaders headers) {
        try {
            String collectUrl = coreSignalBaseUrl + "/company_clean/collect/" + id;
            log.info("[ClientSearch] GET {}", collectUrl);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                collectUrl, HttpMethod.GET, entity, String.class);

            log.info("[ClientSearch] Collect id={} status={}", id, resp.getStatusCode());
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("[ClientSearch] Collect id={} failed or empty body", id);
                return null;
            }

            JsonNode c = objectMapper.readTree(resp.getBody());

            String companyName   = c.path("name").asText("Unknown");
            String industry      = c.path("industry").asText("");
            String sizeRange     = c.path("size_range").asText("");
            String city          = c.path("location_hq_city").asText("");
            String country       = c.path("location_hq_country").asText("");
            String location      = city.isBlank() ? country : city + ", " + country;

            log.info("[ClientSearch] Parsed id={} name='{}' industry='{}' size_range='{}' country='{}' city='{}'",
                    id, companyName, industry, sizeRange, country, city);
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
                companyName, industry, sizeRange, location,
                fundingEvent != null ? fundingEvent : hiringSignal + " hiring signal",
                signals, openRoles, matchScore, (int) Math.round(growthPct),
                decisionMakers,
                description, websiteUrl, linkedinUrl, foundedYear, companyType,
                specialties, newsArticles, totalEmployees, postingsGrowthPct,
                city, country);

        } catch (Exception e) {
            log.error("[ClientSearch] collectCompany id={} threw: {}", id, e.getMessage(), e);
            return null;
        }
    }

    // ─── POST /api/clients/outreach ───────────────────────────────────────────

    public String generateOutreachMessage(String loginId, OutreachRequest req) {
        if (!tokenService.deductToken(loginId))
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");

        String systemPrompt = """
                You are an expert B2B sales copywriter specialising in recruitment agency outreach.
                Write a concise, personalised cold outreach email (150–200 words) to a hiring decision-maker.
                Tone: professional, warm, consultative — never salesy.
                Structure: 1 opening hook tied to their recent signal, 2 lines on how the agency can help, 1 clear CTA.
                Return only the email body — no subject line, no markdown, no sign-off.
                """;

        String userPrompt = String.format("""
                Client company: %s
                Contact name: %s
                Industry: %s
                Recent hiring signals: %s
                Agency name: Nolyvra
                """,
                req.clientName(),
                req.contactName() != null && !req.contactName().isBlank() ? req.contactName() : "Hiring Manager",
                req.industry() != null && !req.industry().isBlank() ? req.industry() : "Technology",
                req.recentSignals() != null && !req.recentSignals().isBlank() ? req.recentSignals() : "recent growth and expansion");

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
}
