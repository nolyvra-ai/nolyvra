package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateAnalysisResponse;
import com.nolyvra.app.model.CandidateResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnExpression("'${nolyvra.mock-ai:false}' == 'true' || '${openai.api-key:}'.startsWith('sk-local-placeholder')")
public class MockCandidateAnalysisRunner implements CandidateAnalysisRunner {

    @Override
    public CandidateAnalysisResponse analyze(
            String candidateId,
            CandidateResponse candidate,
            String loginId,
            String jdText,
            String cvText,
            String linkedinUrl) {
        var scores = new CandidateAnalysisResponse.Scores(82, 78, "Low");
        var consistency = new CandidateAnalysisResponse.Consistency(
                88,
                List.of(new CandidateAnalysisResponse.Consistency.Flag(
                        "Low",
                        "OTHER",
                        "Mock mode: no external AI call was made.")));
        var rows = List.of(
                new CandidateAnalysisResponse.CapabilityMatrix.Row("System Design", 25, 80, "Low"),
                new CandidateAnalysisResponse.CapabilityMatrix.Row("Cloud Architecture", 25, 74, "Medium"),
                new CandidateAnalysisResponse.CapabilityMatrix.Row("Leadership", 25, 76, "Medium"),
                new CandidateAnalysisResponse.CapabilityMatrix.Row("Domain Knowledge", 25, 82, "Low"));
        var matrix = new CandidateAnalysisResponse.CapabilityMatrix(
                rows,
                Map.of("System Design", 25, "Cloud Architecture", 25, "Leadership", 25, "Domain Knowledge", 25));
        var questions = List.of(
                new CandidateAnalysisResponse.SuggestedQuestion(1, "system_design", "This mock question checks architecture depth for the selected role. A strong answer should explain tradeoffs, scaling constraints, and operational risks.", "Walk me through a system you designed and the tradeoffs you made."),
                new CandidateAnalysisResponse.SuggestedQuestion(2, "debugging", "This mock question checks practical troubleshooting ability. A strong answer should show structured diagnosis and clear ownership.", "Describe a production issue you debugged end to end."),
                new CandidateAnalysisResponse.SuggestedQuestion(3, "behavioral", "This mock question checks collaboration style. A strong answer should show clear communication under ambiguity.", "Tell me about a time you aligned multiple stakeholders."),
                new CandidateAnalysisResponse.SuggestedQuestion(4, "architecture", "This mock question checks design judgement. A strong answer should balance simplicity, reliability, and delivery speed.", "How would you improve reliability in a growing SaaS platform?"),
                new CandidateAnalysisResponse.SuggestedQuestion(5, "leadership", "This mock question checks ownership. A strong answer should show initiative and measurable impact.", "Describe a technical decision you led."),
                new CandidateAnalysisResponse.SuggestedQuestion(6, "domain", "This mock question checks role alignment. A strong answer should connect previous experience to the job requirements.", "Which parts of this role map best to your recent experience?"));

        return new CandidateAnalysisResponse(
                candidateId,
                candidate.jobId(),
                Instant.now(),
                scores,
                consistency,
                matrix,
                questions,
                List.of("Mock mode enabled", "Validate real signal with interview follow-up"),
                "Mock analysis generated for local development. Use a real OpenAI key for production scoring.",
                candidate.name(),
                List.of("Java", "Spring Boot", "PostgreSQL"),
                List.of("Production AI validation"),
                List.of(
                        new CandidateAnalysisResponse.ConsistencyBreakdownItem("Employment Timeline", true, null, 85),
                        new CandidateAnalysisResponse.ConsistencyBreakdownItem("Job Titles", true, null, 80),
                        new CandidateAnalysisResponse.ConsistencyBreakdownItem("Skills Listed", true, null, 78),
                        new CandidateAnalysisResponse.ConsistencyBreakdownItem("Education", true, null, 82)),
                List.of(
                        new CandidateAnalysisResponse.StrengthSignal("⭐", "Relevant backend profile", "Mock signal based on local test mode.", "Mock"),
                        new CandidateAnalysisResponse.StrengthSignal("✅", "CV parsed successfully", "The local extraction pipeline completed.", "Local")),
                new CandidateAnalysisResponse.AiVerdict("Proceed with Caution", "Mock result for local development only."),
                "Medium",
                "Generated without external AI calls.",
                2,
                "Mock execution tier for local testing.");
    }
}
