package com.depthhire.app.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record CandidateAnalysisResponse(
    String candidateId,
    String jobId,
    Instant analyzedAt,

    Scores scores,
    Consistency consistency,
    CapabilityMatrix capabilityMatrix,
    List<SuggestedQuestion> suggestedQuestions,

    List<String> riskFlags,
    String recommendation,
    String candidate_name
) {
  public record Scores(
      int consistencyScore,   // 0-100
      int capabilityScore,    // 0-100
      String riskLevel        // Low/Medium/High
  ) {}

  public record Consistency(
      int timelineMatchPercent,
      List<Flag> flags
  ) {
    public record Flag(
        String severity,     // Low/Medium/High
        String type,         // DATE_MISMATCH, TITLE_MISMATCH, MISSING_ROLE...
        String message
    ) {}
  }

  public record CapabilityMatrix(
      List<Row> rows,
      Map<String, Integer> weights // optional
  ) {
    public record Row(
        String capability,
        int weightPercent,
        int scorePercent,
        String gapLevel       // Low/Medium/High
    ) {}
  }

  public record SuggestedQuestion(
      int order,
      String type,            // system_design/architecture/behavioral/debugging
      String intent,          // what we're probing
      String question
  ) {}
}
