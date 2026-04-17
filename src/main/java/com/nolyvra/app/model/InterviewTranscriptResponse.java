package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

public record InterviewTranscriptResponse(
        String id,
        String interviewId,
        String candidateId,
        String interviewType,
        String interviewer,
        Instant scheduledAt,
        String meetingLink,
        String transcriptSource,
        Instant fetchedAt,

        // AI Analysis scores
        String overallSentiment,         // Positive | Neutral | Negative
        Integer sentimentScore,          // 0-100
        Integer communicationScore,      // 0-100
        Integer technicalScore,          // 0-100
        Integer culturalFitScore,        // 0-100
        String confidenceLevel,          // High | Medium | Low

        // AI Analysis structured output
        List<String> keyStrengths,
        List<String> areasOfConcern,
        List<NotableMoment> notableMoments,
        List<String> cvAlignmentInsights,  // comparison with CV analysis
        String interviewSummary,
        String hiringRecommendation,       // Strong Yes | Yes | Maybe | No | Strong No

        Instant analyzedAt,
        Instant createdAt
) {
    public record NotableMoment(String speaker, String quote, String significance) {}
}
