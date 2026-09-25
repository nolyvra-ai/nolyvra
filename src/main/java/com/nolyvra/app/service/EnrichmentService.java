package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.EnrichmentResultResponse;
import com.nolyvra.app.model.EnrichmentStartRequest;
import com.nolyvra.app.model.EnrichmentStartResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

// Candidate email lookup via MatchKraft's email-finder API. Flat 10-token charge
// (reuses TokenService.deductToken, already exactly 10/call) deducted upfront,
// same as every other external search source in this app — regardless of
// whether a company/website/email can ultimately be resolved.
//
// MatchKraft needs firstName/lastName/website per candidate, but nothing in this
// app stores a candidate's company *website* (only a name, and only for some
// sources) — so this resolves it in up to two OpenAI calls: extract the most
// recent employer from CV text when no company name is already known (DB
// candidates), then turn a company name into a best-guess website domain.
@Service
public class EnrichmentService {

    private final ObjectMapper objectMapper;
    private final OpenAIClient openAI;
    private final RestTemplate restTemplate;
    private final TokenService tokenService;
    private final CandidateService candidateService;
    private final String model;
    private final String matchkraftApiKey;
    private final String matchkraftBaseUrl;

    public EnrichmentService(
            ObjectMapper objectMapper,
            OpenAIClient openAIClient,
            TokenService tokenService,
            CandidateService candidateService,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${matchkraft.api-key:}") String matchkraftApiKey,
            @Value("${matchkraft.base-url:https://app.matchkraft.com}") String matchkraftBaseUrl) {
        this.objectMapper = objectMapper;
        this.openAI = openAIClient;
        this.restTemplate = new RestTemplate();
        this.tokenService = tokenService;
        this.candidateService = candidateService;
        this.model = model;
        this.matchkraftApiKey = matchkraftApiKey;
        this.matchkraftBaseUrl = matchkraftBaseUrl;
    }

    // ─── POST /api/enrichment/start ────────────────────────────────────────────

    public EnrichmentStartResponse start(EnrichmentStartRequest req, String loginId) {
        if (matchkraftApiKey == null || matchkraftApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email finder is not configured.");
        }
        if (req.firstName() == null || req.firstName().isBlank()
                || req.lastName() == null || req.lastName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Candidate name is required for enrichment.");
        }
        if (!tokenService.deductToken(loginId)) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");
        }

        String companyName = req.currentCompany() != null && !req.currentCompany().isBlank()
                ? req.currentCompany()
                : resolveCompanyFromCv(req.candidateId(), loginId);

        if (companyName == null || companyName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "No company information available for this candidate — cannot resolve an email.");
        }

        String website = resolveWebsite(companyName);
        if (website == null || website.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Could not determine a website for \"" + companyName + "\".");
        }

        String jobId = callMatchKraftStart(req.firstName(), req.lastName(), website);
        return new EnrichmentStartResponse(jobId, "PENDING", req.candidateId());
    }

    private String resolveCompanyFromCv(String candidateId, String loginId) {
        if (candidateId == null || candidateId.isBlank()) return null;
        return candidateService.getCandidate(candidateId, loginId)
                .map(c -> extractCompanyFromCv(c.cvText()))
                .orElse(null);
    }

    private String extractCompanyFromCv(String cvText) {
        if (cvText == null || cvText.isBlank()) return null;
        String systemPrompt = """
                You extract the candidate's most recent/current employer from their CV text.
                Respond with ONLY the company name, no explanation.
                If none can be determined, respond with exactly: NONE
                """;
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage("CV:\n" + cvText)
                .temperature(0.1)
                .build();
        try {
            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content()
                    .orElse("NONE").strip();
            return "NONE".equalsIgnoreCase(content) ? null : content;
        } catch (Exception e) {
            System.err.println("[Enrichment] extractCompanyFromCv failed: " + e.getMessage());
            return null;
        }
    }

    private String resolveWebsite(String companyName) {
        String systemPrompt = """
                You provide the official website domain for a company, given its name.
                Respond with ONLY the bare domain (e.g. example.com) — no protocol, no path, no explanation.
                If you cannot confidently determine it, respond with exactly: NONE
                """;
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage("COMPANY: " + companyName)
                .temperature(0.1)
                .build();
        try {
            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content()
                    .orElse("NONE").strip();
            if ("NONE".equalsIgnoreCase(content)) return null;
            return content.replaceAll("^https?://", "").replaceAll("^www\\.", "").replaceAll("/.*$", "");
        } catch (Exception e) {
            System.err.println("[Enrichment] resolveWebsite failed: " + e.getMessage());
            return null;
        }
    }

    private String callMatchKraftStart(String firstName, String lastName, String website) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", matchkraftApiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> record = Map.of("firstName", firstName, "lastName", lastName, "website", website);
        Map<String, Object> body = Map.of("jobName", "Nolyvra enrichment", "records", List.of(record));
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    matchkraftBaseUrl + "/api/v2/email-finder", HttpMethod.POST, entity, String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Email finder request failed.");
            }
            JsonNode node = objectMapper.readTree(resp.getBody());
            String jobId = textField(node, "jobId");
            if (jobId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Email finder did not return a job id.");
            }
            return jobId;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Email finder request failed: " + e.getMessage());
        }
    }

    // ─── GET /api/enrichment/{jobId} ───────────────────────────────────────────

    public EnrichmentResultResponse getResult(String jobId, String candidateId, String loginId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", matchkraftApiKey);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    matchkraftBaseUrl + "/api/v2/email-finder/results/" + jobId, HttpMethod.GET, entity, String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                return new EnrichmentResultResponse(jobId, "FAILED", null, candidateId);
            }
            JsonNode node = objectMapper.readTree(resp.getBody());
            String status = textField(node, "status");
            String email = extractEmail(node);

            if (email != null && !email.isBlank() && candidateId != null && !candidateId.isBlank()) {
                candidateService.updateEmail(candidateId, loginId, email);
            }
            return new EnrichmentResultResponse(jobId, status != null ? status : "PENDING", email, candidateId);
        } catch (Exception e) {
            System.err.println("[Enrichment] getResult failed for job " + jobId + ": " + e.getMessage());
            return new EnrichmentResultResponse(jobId, "FAILED", null, candidateId);
        }
    }

    // Defensive — we don't have a confirmed sample of MatchKraft's results response
    // shape, only the POST's PENDING response. Tries the field names/paths most
    // email-finder APIs use, and logs the raw response when none match so the real
    // shape can be read from logs and this can be corrected after a live test call.
    private String extractEmail(JsonNode root) {
        String direct = textField(root, "email");
        if (direct != null) return direct;

        JsonNode records = root.path("records");
        if (records.isMissingNode() || !records.isArray()) records = root.path("results");
        if (records.isArray() && !records.isEmpty()) {
            JsonNode first = records.get(0);
            String fromRecord = textField(first, "email");
            if (fromRecord != null) return fromRecord;
            JsonNode emails = first.path("emails");
            if (emails.isArray() && !emails.isEmpty()) {
                JsonNode firstEmail = emails.get(0);
                if (firstEmail.isTextual()) return firstEmail.asText();
                String nested = textField(firstEmail, "email", "address");
                if (nested != null) return nested;
            }
        }
        JsonNode topEmails = root.path("emails");
        if (topEmails.isArray() && !topEmails.isEmpty() && topEmails.get(0).isTextual()) {
            return topEmails.get(0).asText();
        }

        System.out.println("[Enrichment] no email field matched in results response: " + root);
        return null;
    }

    private String textField(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode v = node.path(key);
            if (!v.isMissingNode() && !v.isNull() && !v.asText().isBlank()) return v.asText();
        }
        return null;
    }
}
