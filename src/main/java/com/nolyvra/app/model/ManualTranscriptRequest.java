package com.nolyvra.app.model;

public record ManualTranscriptRequest(
        String interviewId,      // which interview this transcript belongs to (nullable)
        String transcriptText    // raw pasted transcript content
) {}
