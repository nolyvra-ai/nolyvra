package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.ClientRequest;
import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.OutreachRequest;
import com.nolyvra.app.model.PotentialClientResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
public class ClientService {

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
                    recentJobs);
        }, loginId);
    }

    // ─── Helper: fetch up to 5 recent jobs (title + age + status) for a company

    public List<ClientResponse.JobSummary> getClientJobs(String companyName, String loginId) {
        return jdbc.query("""
                SELECT title, status,
                       EXTRACT(DAY FROM now() - created_at)::int AS days_old
                FROM jobs
                WHERE login_id = ? AND lower(company) = lower(?)
                ORDER BY created_at DESC LIMIT 5
                """,
                (rs, i) -> new ClientResponse.JobSummary(
                        rs.getString("title"),
                        rs.getInt("days_old"),
                        rs.getString("status")),
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
            var ts = rs.getTimestamp("created_at");
            return new ClientResponse(
                    rs.getLong("id"), rs.getString("login_id"), companyName,
                    rs.getString("industry"), rs.getString("company_size"), rs.getString("location"),
                    rs.getString("contact_person"), rs.getString("contact_email"), rs.getString("contact_title"),
                    rs.getString("linkedin_url"), rs.getString("notes"),
                    rs.getString("last_funding_event"), rs.getString("last_funding_amount"),
                    ts != null ? ts.toInstant() : null,
                    rs.getInt("active_job_count"), rs.getInt("filled_job_count"), rs.getInt("total_job_count"),
                    recentJobs);
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
                null, null, Instant.now(), 0, 0, 0, List.of());
    }

    // ─── GET /api/clients/potential ───────────────────────────────────────────

    public List<PotentialClientResponse> getPotentialClients(String loginId) {
        if (coreSignalApiKey == null || coreSignalApiKey.isBlank()) {
            return List.of();
        }
        try {
            return fetchFromCoreSignal(loginId);
        } catch (Exception e) {
            return List.of();
        }
    }

    // ─── CoreSignal: search + collect company profiles ────────────────────────

    private List<PotentialClientResponse> fetchFromCoreSignal(String loginId) throws Exception {

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", coreSignalApiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> query = Map.of("query", Map.of("match_all", Map.of()));

        HttpEntity<Map<String, Object>> searchEntity = new HttpEntity<>(query, headers);
        ResponseEntity<String> searchResp = restTemplate.exchange(
            coreSignalBaseUrl + "/company_clean/search/es_dsl",
            HttpMethod.POST, searchEntity, String.class);

        String rawBody = searchResp.getBody();
        if (!searchResp.getStatusCode().is2xxSuccessful() || rawBody == null) {
            return List.of();
        }

        JsonNode idsNode = objectMapper.readTree(rawBody);
        if (!idsNode.isArray() || idsNode.size() == 0) return List.of();

        List<Integer> ids = new ArrayList<>();
        for (int i = 0; i < Math.min(8, idsNode.size()); i++) {
            ids.add(idsNode.get(i).asInt());
        }

        ExecutorService pool = Executors.newFixedThreadPool(3);
        List<CompletableFuture<PotentialClientResponse>> futures = ids.stream()
            .map(id -> CompletableFuture.supplyAsync(() -> collectCompany(id, headers), pool))
            .collect(Collectors.toList());

        List<PotentialClientResponse> results = futures.stream()
            .map(CompletableFuture::join)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(PotentialClientResponse::matchScore).reversed())
            .limit(4)
            .collect(Collectors.toList());

        pool.shutdown();
        return results;
    }

    // ─── Collect a single company profile by ID ───────────────────────────────

    private PotentialClientResponse collectCompany(int id, HttpHeaders headers) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                coreSignalBaseUrl + "/company_clean/collect/" + id,
                HttpMethod.GET, entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return null;

            JsonNode c = objectMapper.readTree(resp.getBody());

            String companyName = c.path("name").asText("Unknown");
            String industry    = c.path("industry").asText("");
            String sizeRange   = c.path("size_range").asText("");
            String city        = c.path("hq_city").asText("");
            String country     = c.path("hq_country").asText("");
            String location    = city.isBlank() ? country : city + ", " + country;
            int openRoles      = c.path("active_job_postings_count").asInt(0);

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
                for (int i = 0; i < Math.min(3, executives.size()); i++) {
                    JsonNode exec = executives.get(i);
                    String name  = exec.path("member_full_name").asText("");
                    String title = exec.path("member_position_title").asText("");
                    if (!name.isBlank()) {
                        decisionMakers.add(new PotentialClientResponse.DecisionMaker(name, title));
                    }
                }
            }

            return new PotentialClientResponse(
                companyName, industry, sizeRange, location,
                fundingEvent != null ? fundingEvent : hiringSignal + " hiring signal",
                signals, openRoles, matchScore, (int) Math.round(growthPct),
                decisionMakers);

        } catch (Exception e) {
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
