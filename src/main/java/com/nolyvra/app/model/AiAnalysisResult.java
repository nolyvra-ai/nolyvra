package com.nolyvra.app.model;

import java.util.List;

public record AiAnalysisResult(
    CandidateAnalysisResponse.Scores scores,
    CandidateAnalysisResponse.Consistency consistency,
    CandidateAnalysisResponse.CapabilityMatrix capabilityMatrix,
    List<CandidateAnalysisResponse.SuggestedQuestion> suggestedQuestions,
    List<String> riskFlags,
    String recommendation
) {}
