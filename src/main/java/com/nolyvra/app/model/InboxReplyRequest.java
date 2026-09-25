package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record InboxReplyRequest(
    @NotBlank String provider,      // "microsoft" | "google"
    String threadId,                // provider conversation/thread id being replied to
    @NotBlank String toAddress,
    @NotBlank String subject,
    @NotBlank String body,
    String candidateId              // optional — links the reply into the candidate's email history like compose-sent mail
) {}
