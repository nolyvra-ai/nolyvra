package com.nolyvra.app.model;

// Public POST /api/public/interview/{token}/answers — ack for one recorded answer.
public record InterviewAnswerResponse(
        int questionOrder,
        String status
) {}
