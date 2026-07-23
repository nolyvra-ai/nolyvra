package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record MessageGenerateRequest(
    @NotBlank String candidateId,
    @NotBlank String messageType,   // INTERVIEW_INVITE | FOLLOW_UP | REJECTION | OFFER
    String customPrompt,            // optional recruiter override prompt
    String jobId                    // optional — targets one job_applications row (Jobs Applied tab); falls back to the candidate's cached current job when absent
) {}
