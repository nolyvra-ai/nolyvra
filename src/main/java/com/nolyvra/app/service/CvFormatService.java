package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateAnalysisResponse;
import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.JobResponse;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pro.verron.officestamper.api.OfficeStamperException;
import pro.verron.officestamper.preset.ExceptionResolvers;
import pro.verron.officestamper.preset.OfficeStamperConfigurations;
import pro.verron.officestamper.preset.OfficeStampers;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// ─── "Format CV" feature ────────────────────────────────────────────────────
// Stamps a candidate's data into a recruiter-supplied .docx template (merge
// fields like ${name}, ${cvBody}, ${agency_name}), preserving the template's
// exact formatting — no AI, no layout regeneration. The template only
// supplies the visual design; content comes entirely from stored data.
//
// Templates are recruiter-authored and their merge-field naming is
// unpredictable ("candidate_name" vs "name" vs "full_name" etc.), so a fixed
// set of context keys isn't enough. Every ${...} token actually present in
// the uploaded template is scanned out first, then resolved by keyword
// against known concepts (candidate/consultant/agency/job/analysis/date) —
// any token that can't be confidently classified resolves to "" rather than
// failing the stamp.

@Service
public class CvFormatService {

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\$\\{\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*}");

    private final CandidateService candidateService;
    private final AnalysisService analysisService;
    private final CvTemplateService cvTemplateService;
    private final JobService jobService;
    private final JdbcTemplate jdbc;

    public CvFormatService(
            CandidateService candidateService,
            AnalysisService analysisService,
            CvTemplateService cvTemplateService,
            JobService jobService,
            JdbcTemplate jdbc) {
        this.candidateService = candidateService;
        this.analysisService = analysisService;
        this.cvTemplateService = cvTemplateService;
        this.jobService = jobService;
        this.jdbc = jdbc;
    }

    public byte[] formatCv(String candidateId, String loginId, String templateId, boolean attachScore) {
        CandidateResponse candidate = candidateService.getCandidate(candidateId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found: " + candidateId));

        if (candidate.cvText() == null || candidate.cvText().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This candidate has no CV on file to format.");
        }

        byte[] templateBytes = cvTemplateService.getDocxData(templateId, loginId);
        CandidateAnalysisResponse analysis = attachScore ? analysisService.getAIAnalysisForCandidate(candidateId) : null;

        JobResponse job = candidate.jobId() != null
                ? jobService.getJob(candidate.jobId(), loginId).orElse(null)
                : null;
        Map<String, String> login = getLoginInfo(loginId);

        Map<String, Object> context = buildContext(candidate, job, login, analysis);
        addDynamicallyDiscoveredFields(context, templateBytes, candidate, job, login, analysis);

        // Defense in depth: the keyword resolver above handles simple ${identifier}
        // tokens by naming convention, but templates can also contain stray/invalid
        // expressions (e.g. literal "${...}" left over from instructional text) that
        // fail at SpEL parse time, before any context data is even consulted. This
        // lenient exception resolver guarantees the stamp never aborts the whole
        // document over one bad expression — it blanks just that expression instead.
        var config = OfficeStamperConfigurations.standard()
                .setExceptionResolver(ExceptionResolvers.defaulting(""));
        var stamper = OfficeStampers.docxStamper(config);
        try (var templateStream = new ByteArrayInputStream(templateBytes);
             var out = new ByteArrayOutputStream()) {
            stamper.stamp(templateStream, context, out);
            return out.toByteArray();
        } catch (OfficeStamperException | java.io.IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not stamp this template: " + e.getMessage());
        }
    }

    // ── Fixed, known-good aliases (fast path for common naming) ──────────────

    private Map<String, Object> buildContext(CandidateResponse candidate, JobResponse job,
                                              Map<String, String> login, CandidateAnalysisResponse analysis) {
        Map<String, Object> ctx = new LinkedHashMap<>();

        putBoth(ctx, "name", nullToEmpty(candidate.name()));
        putBoth(ctx, "email", nullToEmpty(candidate.email()));
        putBoth(ctx, "phone", nullToEmpty(candidate.phone()));
        putBoth(ctx, "linkedinUrl", "linkedin_url", nullToEmpty(candidate.linkedinUrl()));
        putBoth(ctx, "currentTitle", "current_title", nullToEmpty(candidate.currentTitle()));
        putBoth(ctx, "location", nullToEmpty(candidate.location()));
        putBoth(ctx, "state", nullToEmpty(candidate.state()));
        putBoth(ctx, "skills", candidate.skills() == null ? "" : String.join(", ", candidate.skills()));
        putBoth(ctx, "cvBody", "cv_body", nullToEmpty(candidate.cvText()));
        putBoth(ctx, "yearsExperience", "years_experience",
                candidate.yearsExperience() == null ? "" : candidate.yearsExperience().toPlainString());
        putBoth(ctx, "seniorityLevel", "seniority_level", nullToEmpty(candidate.seniorityLevel()));
        putBoth(ctx, "noticePeriodWeeks", "notice_period_weeks",
                candidate.noticePeriodWeeks() == null ? "" : String.valueOf(candidate.noticePeriodWeeks()));
        putBoth(ctx, "workRights", "work_rights", nullToEmpty(candidate.workRights()));
        putBoth(ctx, "remoteFlexible", "remote_flexible",
                Boolean.TRUE.equals(candidate.remoteFlexible()) ? "Yes" : "No");
        putBoth(ctx, "expectedSalary", "expected_salary", formatSalaryRange(candidate));

        putBoth(ctx, "jobTitle", "job_title", job == null ? "" : nullToEmpty(job.title()));
        putBoth(ctx, "jobCompany", "job_company", job == null ? "" : nullToEmpty(job.company()));

        putBoth(ctx, "consultantName", "consultant_name", login.get("name"));
        putBoth(ctx, "consultantEmail", "consultant_email", login.get("email"));
        putBoth(ctx, "consultantPhone", "consultant_phone", login.get("phone_number"));
        putBoth(ctx, "agencyName", "agency_name", login.get("company"));

        putBoth(ctx, "date", today());

        String consistencyScore = "", capabilityScore = "", riskLevel = "", recommendation = "";
        if (analysis != null) {
            if (analysis.scores() != null) {
                consistencyScore = analysis.scores().consistencyScore() + "%";
                capabilityScore = analysis.scores().capabilityScore() + "%";
                riskLevel = analysis.scores().riskLevel() == null ? "" : analysis.scores().riskLevel();
            }
            recommendation = analysis.recommendation() == null ? "" : analysis.recommendation();
        }
        putBoth(ctx, "consistencyScore", "consistency_score", consistencyScore);
        putBoth(ctx, "capabilityScore", "capability_score", capabilityScore);
        putBoth(ctx, "riskLevel", "risk_level", riskLevel);
        putBoth(ctx, "recommendation", recommendation);

        return ctx;
    }

    // ── Dynamic fallback: whatever ${...} tokens the template actually has,
    // resolved by keyword. Never leaves a token unmapped (defaults to ""),
    // so an unrecognized field name blanks out instead of failing the stamp. ──

    private void addDynamicallyDiscoveredFields(Map<String, Object> ctx, byte[] templateBytes,
                                                  CandidateResponse candidate, JobResponse job,
                                                  Map<String, String> login, CandidateAnalysisResponse analysis) {
        String templateText;
        try (var in = new ByteArrayInputStream(templateBytes);
             XWPFDocument doc = new XWPFDocument(in);
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            templateText = extractor.getText();
        } catch (Exception e) {
            return; // not a readable .docx — let the stamp step itself report the real error
        }

        Matcher m = PLACEHOLDER_PATTERN.matcher(templateText);
        while (m.find()) {
            String token = m.group(1);
            if (ctx.containsKey(token)) continue; // already covered by the fixed alias set above
            ctx.put(token, resolveByKeyword(token, candidate, job, login, analysis));
        }
    }

    private String resolveByKeyword(String rawToken, CandidateResponse candidate, JobResponse job,
                                     Map<String, String> login, CandidateAnalysisResponse analysis) {
        Set<String> words = splitWords(rawToken);

        boolean isConsultant = words.contains("consultant") || words.contains("recruiter")
                || (words.contains("prepared") && words.contains("by"));
        boolean isJob = words.contains("job") || words.contains("client") || words.contains("vacancy");
        boolean isAgency = !isJob && !isConsultant && words.contains("agency")
                || (!isJob && !isConsultant && words.contains("company") && !words.contains("candidate"));
        boolean isAnalysis = words.contains("score") || words.contains("consistency")
                || words.contains("capability") || words.contains("risk") || words.contains("recommendation");
        boolean isDocument = words.contains("date") || words.contains("today");

        if (isDocument) return today();

        if (isAnalysis) {
            if (words.contains("consistency")) return analysis != null && analysis.scores() != null ? analysis.scores().consistencyScore() + "%" : "";
            if (words.contains("capability")) return analysis != null && analysis.scores() != null ? analysis.scores().capabilityScore() + "%" : "";
            if (words.contains("risk")) return analysis != null && analysis.scores() != null ? nullToEmpty(analysis.scores().riskLevel()) : "";
            if (words.contains("recommendation")) return analysis != null ? nullToEmpty(analysis.recommendation()) : "";
            return "";
        }

        if (isConsultant) {
            if (words.contains("email") || words.contains("mail")) return login.get("email");
            if (words.contains("phone") || words.contains("mobile")) return login.get("phone_number");
            return login.get("name");
        }

        if (isAgency) return login.get("company");

        if (isJob) {
            if (words.contains("company") || words.contains("client")) return job == null ? "" : nullToEmpty(job.company());
            return job == null ? "" : nullToEmpty(job.title());
        }

        // Default role: candidate
        if (words.contains("email") || words.contains("mail")) return nullToEmpty(candidate.email());
        if (words.contains("phone") || words.contains("mobile")) return nullToEmpty(candidate.phone());
        if (words.contains("location") || words.contains("city") || words.contains("address")) return nullToEmpty(candidate.location());
        // "linkedin" splits apart on the internal capital I in compound camelCase
        // (e.g. "candidateLinkedIn" -> {linked, in}) — check the joined form too.
        if (words.contains("linkedin") || rawToken.toLowerCase().contains("linkedin")) return nullToEmpty(candidate.linkedinUrl());
        if (words.contains("skills")) return candidate.skills() == null ? "" : String.join(", ", candidate.skills());
        // No structured summary exists without AI extraction — falls back to the full CV body.
        if (words.contains("summary") || words.contains("profile") || words.contains("about")
                || words.contains("body") || words.contains("cv") || words.contains("resume")
                || words.contains("experience") || words.contains("education")) return nullToEmpty(candidate.cvText());
        if (words.contains("title") || words.contains("role") || words.contains("position")) return nullToEmpty(candidate.currentTitle());
        if (words.contains("name")) return nullToEmpty(candidate.name());

        return "";
    }

    private Set<String> splitWords(String token) {
        String withUnderscores = token.replaceAll("([a-z])([A-Z])", "$1_$2");
        String[] parts = withUnderscores.toLowerCase().split("[^a-z0-9]+");
        Set<String> words = new LinkedHashSet<>();
        for (String p : parts) if (!p.isBlank()) words.add(p);
        return words;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private String today() {
        return LocalDate.now().format(DateTimeFormatter.ofPattern("d MMMM yyyy"));
    }

    private String formatSalaryRange(CandidateResponse candidate) {
        if (candidate.expectedSalaryMin() == null && candidate.expectedSalaryMax() == null) return "";
        String currency = candidate.salaryCurrency() == null ? "" : candidate.salaryCurrency() + " ";
        if (candidate.expectedSalaryMin() != null && candidate.expectedSalaryMax() != null) {
            return currency + candidate.expectedSalaryMin().toPlainString() + " - " + candidate.expectedSalaryMax().toPlainString();
        }
        var single = candidate.expectedSalaryMin() != null ? candidate.expectedSalaryMin() : candidate.expectedSalaryMax();
        return currency + single.toPlainString();
    }

    private Map<String, String> getLoginInfo(String loginId) {
        Map<String, String> result = new LinkedHashMap<>();
        var rows = jdbc.queryForList(
                "SELECT name, company, email, phone_number FROM login WHERE id = ?", loginId);
        if (!rows.isEmpty()) {
            var row = rows.get(0);
            result.put("name", nullToEmpty((String) row.get("name")));
            result.put("company", nullToEmpty((String) row.get("company")));
            result.put("email", nullToEmpty((String) row.get("email")));
            result.put("phone_number", nullToEmpty((String) row.get("phone_number")));
        } else {
            result.put("name", ""); result.put("company", ""); result.put("email", ""); result.put("phone_number", "");
        }
        return result;
    }

    private void putBoth(Map<String, Object> ctx, String key, String value) {
        ctx.put(key, value);
    }

    private void putBoth(Map<String, Object> ctx, String camelCase, String snakeCase, String value) {
        ctx.put(camelCase, value);
        ctx.put(snakeCase, value);
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
