package com.nolyvra.app.model;

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
    String candidate_name,

    // ── MVP2 additions ────────────────────────────────────────────────────
    List<String> matchedSkills,
    List<String> missingSkills,
    List<ConsistencyBreakdownItem> consistencyBreakdown,
    List<StrengthSignal> strengthSignals,
    AiVerdict aiVerdict,
    String aiConfidence,
    String aiConfidenceNote,
    Integer executionTier,
    String executionTierNote

) {
  // ── Existing nested records (unchanged) ──────────────────────────────────

  public record Scores(
      int consistencyScore,
      int capabilityScore,
      String riskLevel
  ) {}

  public record Consistency(
      int timelineMatchPercent,
      List<Flag> flags
  ) {
    public record Flag(
        String severity,
        String type,
        String message
    ) {}
  }

  public record CapabilityMatrix(
      List<Row> rows,
      Map<String, Integer> weights
  ) {
    public record Row(
        String capability,
        int weightPercent,
        int scorePercent,
        String gapLevel
    ) {}
  }

  public record SuggestedQuestion(
      int order,
      String type,
      String intent,
      String question
  ) {}

  // ── MVP2 new nested records ───────────────────────────────────────────────

  public record ConsistencyBreakdownItem(
      String label,
      boolean match,
      String note,       // shown when match = false, e.g. "Partial overlap"
      Integer score      // 0-100, used for the progress bar width
  ) {}

  public record StrengthSignal(
      String icon,        // emoji, e.g. "⭐"
      String title,
      String description,
      String tag          // optional badge label
  ) {}

  public record AiVerdict(
      String title,       // e.g. "Proceed with Caution"
      String summary      // 1-2 sentence summary
  ) {}
}