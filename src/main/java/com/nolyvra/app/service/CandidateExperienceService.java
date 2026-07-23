package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateExperienceResponse;
import com.nolyvra.app.model.CandidateExperienceResponse.EducationEntry;
import com.nolyvra.app.model.CandidateExperienceResponse.WorkExperienceEntry;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

// Candidate detail page — Work Experience / Education section. Extracts a
// structured history from the candidate's already-stored cv_text (no
// re-upload needed) and caches it on candidates.work_experience_json /
// education_json (see additional/sql/V57__candidate_files_and_experience.sql)
// so it's generated once and instant on every later page view — same
// cache-or-generate shape as AnalysisService.getCandidateSummary.
@Service
public class CandidateExperienceService {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;
    private final JdbcTemplate jdbc;
    private final TokenService tokenService;

    public CandidateExperienceService(
            ObjectMapper objectMapper,
            OpenAIClient openAIClient,
            JdbcTemplate jdbcTemplate,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.objectMapper = objectMapper;
        this.openAI = openAIClient;
        this.jdbc = jdbcTemplate;
        this.tokenService = tokenService;
        this.model = model;
    }

    public CandidateExperienceResponse getExperience(String candidateId, String loginId) {
        return getExperience(candidateId, loginId, false);
    }

    public CandidateExperienceResponse getExperience(String candidateId, String loginId, boolean forceRegenerate) {
        if (!forceRegenerate) {
            Optional<CandidateExperienceResponse> cached = loadCached(candidateId);
            if (cached.isPresent()) return cached.get();
        }
        return generateAndPersist(candidateId, loginId);
    }

    private Optional<CandidateExperienceResponse> loadCached(String candidateId) {
        var rows = jdbc.query("""
                select work_experience_json, education_json from candidates where id = ?
                """,
                (rs, r) -> new String[]{ rs.getString("work_experience_json"), rs.getString("education_json") },
                candidateId);
        if (rows.isEmpty()) return Optional.empty();
        String workJson = rows.get(0)[0];
        String eduJson = rows.get(0)[1];
        if (workJson == null || eduJson == null) return Optional.empty();
        try {
            List<WorkExperienceEntry> work = objectMapper.readValue(workJson,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, WorkExperienceEntry.class));
            List<EducationEntry> education = objectMapper.readValue(eduJson,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, EducationEntry.class));
            return Optional.of(new CandidateExperienceResponse(work, education));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private CandidateExperienceResponse generateAndPersist(String candidateId, String loginId) {
        String cvText = loadCvTextFromDb(candidateId);

        String systemPrompt = """
                You are a resume parser. Extract the candidate's work history and
                education from the CV text into structured data.
                Return EXACTLY ONE JSON object:

                {
                  "workExperience": [
                    {"company": "<string>", "title": "<string>", "startDate": "<e.g. Jan 2020>", "endDate": "<e.g. Present>", "description": "<1-2 sentence summary of responsibilities/achievements>"}
                  ],
                  "education": [
                    {"institution": "<string>", "degree": "<string>", "fieldOfStudy": "<string or empty>", "startDate": "<string>", "endDate": "<string>"}
                  ]
                }

                Rules:
                - List roles/degrees in reverse chronological order (most recent first).
                - If a date or field is not stated in the CV, use an empty string — never guess.
                - If the CV has no work history or no education section, return an empty array for that key.
                - No markdown. No extra keys.
                """;

        String userPrompt = "CV TEXT:\n" + safeTrim(cvText, 12000);

        String content = callOpenAI(systemPrompt, userPrompt, loginId);
        try {
            CandidateExperienceResponse result = objectMapper.readValue(cleanJson(content), CandidateExperienceResponse.class);
            jdbc.update("""
                    update candidates
                    set work_experience_json = ?::jsonb, education_json = ?::jsonb, updated_at = now()
                    where id = ?
                    """,
                    objectMapper.writeValueAsString(result.workExperience()),
                    objectMapper.writeValueAsString(result.education()),
                    candidateId);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse work experience/education: " + e.getMessage(), e);
        }
    }

    private String loadCvTextFromDb(String candidateId) {
        return jdbc.query("select cv_text from candidates where id = ?",
                (rs, r) -> rs.getString("cv_text"), candidateId)
                .stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
    }

    private String callOpenAI(String systemPrompt, String userPrompt, String loginId) {
        if (!tokenService.deductToken(loginId)) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");
        }
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage(userPrompt)
                .temperature(0.2)
                .build();
        var completion = openAI.chat().completions().create(params);
        return completion.choices().getFirst().message().content()
                .orElseThrow(() -> new IllegalStateException("Model returned empty content"));
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }

    private static String safeTrim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
