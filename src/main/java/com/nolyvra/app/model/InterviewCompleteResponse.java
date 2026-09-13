package com.nolyvra.app.model;

// Public POST /api/public/interview/{token}/complete — drives the thank-you screen.
public record InterviewCompleteResponse(
        String status,
        String thankYouMessage
) {}
