package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;

public record EmailSendRequest(
    @NotBlank String toAddress,
    @NotBlank String subject,
    @NotBlank String body,
    String candidateId,     // optional — links email to candidate timeline
    String templateType     // INTERVIEW_INVITE | FOLLOW_UP | REJECTION | OFFER
) {}
