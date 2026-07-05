package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.StackAuditLeadResponse;
import com.nolyvra.app.model.StackAuditLeadResponse.*;
import com.nolyvra.app.model.StackAuditRequest;
import com.nolyvra.app.model.StackAuditRequest.AiTool;
import com.nolyvra.app.model.StackAuditRequest.CandidateTool;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class StackAuditService {

    private static final Logger log = LoggerFactory.getLogger(StackAuditService.class);

    // Total ATS / CRM features assumed in a typical full product (for utilisation ratio)
    private static final int REFERENCE_FEATURE_COUNT = 10;

    // In-memory per-IP rate limit: max 3 submissions per 10 minutes
    private static final int RATE_LIMIT_MAX        = 3;
    private static final long RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000L;

    private record RateBucket(List<Long> timestamps) {}
    private final ConcurrentHashMap<String, RateBucket> rateBuckets = new ConcurrentHashMap<>();

    private final JdbcTemplate    jdbc;
    private final ObjectMapper    objectMapper;
    private final OpenAIClient    openAI;
    private final String          model;

    public StackAuditService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            OpenAIClient openAI,
            @Value("${openai.model:gpt-4o-mini}") String model
    ) {
        this.jdbc         = jdbc;
        this.objectMapper = objectMapper;
        this.openAI       = openAI;
        this.model        = model;
    }

    // ── Rate limiting ────────────────────────────────────────────────────────

    public void checkRateLimit(String ip) {
        long now = System.currentTimeMillis();
        rateBuckets.compute(ip, (k, bucket) -> {
            List<Long> ts = bucket == null ? new ArrayList<>() : new ArrayList<>(bucket.timestamps());
            ts.removeIf(t -> now - t > RATE_LIMIT_WINDOW_MS);
            if (ts.size() >= RATE_LIMIT_MAX) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many audit submissions. Please wait a few minutes and try again.");
            }
            ts.add(now);
            return new RateBucket(ts);
        });
    }

    // ── Submit + compute ─────────────────────────────────────────────────────

    public StackAuditLeadResponse submit(StackAuditRequest req) {
        Optional<StackAuditLeadResponse> previous = findRecentSubmission(req.email());
        if (previous.isPresent()) return previous.get();
        Report report = computeReport(req);
        persist(req, report);
        return buildResponse(-1, req.fullName(), req.companyName(), req.email(), req.phone(),
                OffsetDateTime.now(), report, req);
    }

    private Optional<StackAuditLeadResponse> findRecentSubmission(String email) {
        List<StackAuditLeadResponse> rows = jdbc.query("""
                SELECT id, full_name, company_name, email, phone, created_at, computed_report
                FROM stack_audit_submission
                WHERE email = ? AND created_at > NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC LIMIT 1
                """,
                (rs, rowNum) -> buildResponse(
                        rs.getLong("id"),
                        rs.getString("full_name"),
                        rs.getString("company_name"),
                        rs.getString("email"),
                        rs.getString("phone"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        parseReport(rs.getString("computed_report")),
                        null
                ),
                email);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    // ── Deterministic savings calc ───────────────────────────────────────────

    private Report computeReport(StackAuditRequest req) {

        // Candidate search: ~2/3 of combined spend
        int candidateCurrentSpend = req.candidateTools().stream().mapToInt(CandidateTool::expense).sum();
        int candidateNolyvra      = (int) Math.round(candidateCurrentSpend * (2.0 / 3.0));
        CategoryLine candidateLine = new CategoryLine(
                "Candidate Sourcing",
                candidateCurrentSpend,
                candidateNolyvra,
                candidateCurrentSpend - candidateNolyvra,
                "Consolidating multiple job-board/search subscriptions into one search layer."
        );

        // ATS: utilisation ratio maps spend between 1/3 and 1/2
        int atsFeatureCount = req.atsFeatures() == null ? 0 : req.atsFeatures().size();
        double atsRatio     = utilisationRatio(atsFeatureCount);
        int atsNolyvra      = (int) Math.round(req.atsExpense() * atsRatio);
        CategoryLine atsLine = new CategoryLine(
                "ATS",
                req.atsExpense(),
                atsNolyvra,
                req.atsExpense() - atsNolyvra,
                "You appear to use " + atsFeatureCount + " of a typical ATS's features — "
                        + "you may be paying for capability you don't need."
        );

        // CRM/HRM: same utilisation method
        int crmFeatureCount = req.crmFeatures() == null ? 0 : req.crmFeatures().size();
        double crmRatio     = utilisationRatio(crmFeatureCount);
        int crmNolyvra      = (int) Math.round(req.crmExpense() * crmRatio);
        CategoryLine crmLine = new CategoryLine(
                "CRM / Internal HR",
                req.crmExpense(),
                crmNolyvra,
                req.crmExpense() - crmNolyvra,
                "You appear to use " + crmFeatureCount + " of a typical CRM's features — "
                        + "you may be paying for capability you don't need."
        );

        // AI tools + AI agent: full current spend is potential saving (bundled in Nolyvra)
        int aiToolsSpend  = req.aiTools().stream().mapToInt(AiTool::expense).sum();
        int aiAgentSpend  = (req.usesAiAgent() && req.aiAgentExpense() != null) ? req.aiAgentExpense() : 0;
        int aiTotalSpend  = aiToolsSpend + aiAgentSpend;
        CategoryLine aiLine = new CategoryLine(
                "AI Tools & Agent",
                aiTotalSpend,
                0,
                aiTotalSpend,
                "These capabilities are included in Nolyvra, so they're typically eliminated as separate line items."
        );

        // Totals
        int totalCurrent   = candidateCurrentSpend + req.atsExpense() + req.crmExpense() + aiTotalSpend;
        int totalNolyvra   = candidateNolyvra + atsNolyvra + crmNolyvra;
        int totalSaving    = totalCurrent - totalNolyvra;
        int annualSaving   = totalSaving * 12;
        int savingPct      = totalCurrent > 0 ? (int) Math.round((totalSaving * 100.0) / totalCurrent) : 0;

        String narrative = generateNarrative(req, totalCurrent, totalNolyvra, totalSaving, savingPct);

        InputSnapshot snapshot = new InputSnapshot(
                req.candidateTools(), req.atsTool(), req.atsExpense(), req.atsFeatures(),
                req.crmTool(), req.crmExpense(), req.crmFeatures(),
                req.aiTools(), req.usesAiAgent(), req.aiAgentExpense()
        );

        return new Report(candidateLine, atsLine, crmLine, aiLine,
                totalCurrent, totalNolyvra, totalSaving, annualSaving, savingPct,
                narrative, List.of(snapshot));
    }

    // Lower utilisation → closer to 1/3 saving; higher → closer to 1/2
    private double utilisationRatio(int featureCount) {
        double util = Math.min(1.0, (double) featureCount / REFERENCE_FEATURE_COUNT);
        // lerp between 1/3 and 1/2 based on utilisation
        return (1.0 / 3.0) + util * (1.0 / 6.0);
    }

    // ── OpenAI narrative ─────────────────────────────────────────────────────

    private static final String DEFAULT_NARRATIVE =
            "Based on the tools you've listed, your current stack spans multiple specialist "
            + "products that each solve one part of the recruitment picture. Consolidating onto "
            + "a connected platform reduces subscription overhead, eliminates re-keying between "
            + "systems, and gives recruiters a single source of truth — which is typically where "
            + "the real time (and cost) savings show up.";

    private String generateNarrative(
            StackAuditRequest req,
            int totalCurrent, int totalNolyvra, int totalSaving, int savingPct
    ) {
        String systemPrompt = """
                You are a concise, honest recruitment technology advisor writing for a senior recruiter.
                Write 3-4 plain-English sentences explaining where this agency is likely overspending
                and why consolidating onto a lean, connected platform helps.
                Do NOT invent or override the numbers — they are already computed and will be shown separately.
                Do NOT use hyperbole or marketing language. Be direct and human.
                """;

        String toolList = buildToolSummary(req);

        String userPrompt = String.format(
                "Agency stack: %s\n" +
                "Total current monthly spend: $%d AUD. " +
                "Estimated Nolyvra equivalent: $%d AUD. " +
                "Estimated monthly saving: $%d AUD (%d%%).\n" +
                "Write the narrative (3-4 sentences, plain English, honest tone).",
                toolList, totalCurrent, totalNolyvra, totalSaving, savingPct
        );

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage(userPrompt)
                .temperature(0.5)
                .build();

        try {
            return openAI.chat().completions().create(params)
                    .choices().getFirst().message().content()
                    .orElse(DEFAULT_NARRATIVE);
        } catch (Exception e) {
            log.warn("OpenAI narrative generation failed for stack audit, using fallback: {}", e.getMessage());
            return DEFAULT_NARRATIVE;
        }
    }

    private String buildToolSummary(StackAuditRequest req) {
        List<String> parts = new ArrayList<>();
        if (!req.candidateTools().isEmpty()) {
            parts.add("sourcing: " + req.candidateTools().stream().map(CandidateTool::name).toList());
        }
        parts.add("ATS: " + req.atsTool());
        parts.add("CRM: " + req.crmTool());
        if (!req.aiTools().isEmpty()) {
            parts.add("AI tools: " + req.aiTools().stream().map(AiTool::name).toList());
        }
        if (req.usesAiAgent()) parts.add("AI agent integration: yes");
        return String.join("; ", parts);
    }

    // ── Persistence ──────────────────────────────────────────────────────────

    private void persist(StackAuditRequest req, Report report) {
        try {
            jdbc.update("""
                    INSERT INTO stack_audit_submission
                        (full_name, company_name, email, phone,
                         candidate_tools, ats_tool, ats_expense, ats_features,
                         crm_tool, crm_expense, crm_features,
                         ai_tools, uses_ai_agent, ai_agent_expense,
                         consent, computed_report)
                    VALUES (?,?,?,?,
                            CAST(? AS jsonb),?,?,CAST(? AS jsonb),
                            ?,?,CAST(? AS jsonb),
                            CAST(? AS jsonb),?,?,
                            ?,CAST(? AS jsonb))
                    """,
                    req.fullName(), req.companyName(), req.email(), req.phone(),
                    toJson(req.candidateTools()), req.atsTool(), req.atsExpense(), toJson(req.atsFeatures()),
                    req.crmTool(), req.crmExpense(), toJson(req.crmFeatures()),
                    toJson(req.aiTools()), req.usesAiAgent(), req.aiAgentExpense(),
                    req.consent(), toJson(report)
            );
        } catch (Exception e) {
            log.error("Failed to persist stack audit submission", e);
            // Do not surface DB errors to the caller — report is already computed
        }
    }

    // ── Leads list (authenticated) ───────────────────────────────────────────

    public List<StackAuditLeadResponse> getLeads() {
        return jdbc.query("""
                SELECT id, full_name, company_name, email, phone, created_at, computed_report
                FROM stack_audit_submission
                ORDER BY created_at DESC
                LIMIT 200
                """,
                (rs, rowNum) -> {
                    Report report = parseReport(rs.getString("computed_report"));
                    return buildResponse(
                            rs.getLong("id"),
                            rs.getString("full_name"),
                            rs.getString("company_name"),
                            rs.getString("email"),
                            rs.getString("phone"),
                            rs.getObject("created_at", OffsetDateTime.class),
                            report,
                            null
                    );
                }
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "null";
        }
    }

    private Report parseReport(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, Report.class);
        } catch (Exception e) {
            log.warn("Failed to parse stored computed_report", e);
            return null;
        }
    }

    private StackAuditLeadResponse buildResponse(
            long id,
            String fullName, String companyName, String email, String phone,
            OffsetDateTime createdAt,
            Report report,
            StackAuditRequest req
    ) {
        return new StackAuditLeadResponse(id, fullName, companyName, email, phone, createdAt, report);
    }
}
