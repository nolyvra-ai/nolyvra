package com.nolyvra.app.model;

import java.util.List;

public record AiAnalysisResult(
    CandidateAnalysisResponse.Scores scores,
    CandidateAnalysisResponse.Consistency consistency,
    CandidateAnalysisResponse.CapabilityMatrix capabilityMatrix,
    List<CandidateAnalysisResponse.SuggestedQuestion> suggestedQuestions,
    List<String> riskFlags,
    String recommendation,
    List<String> matchedSkills,
    List<String> missingSkills,
    List<CandidateAnalysisResponse.ConsistencyBreakdownItem> consistencyBreakdown,
    List<CandidateAnalysisResponse.StrengthSignal> strengthSignals,
    CandidateAnalysisResponse.AiVerdict aiVerdict,
    String aiConfidence,
    String aiConfidenceNote,
    Integer executionTier,
    String executionTierNote
) {}
