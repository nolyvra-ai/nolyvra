package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record InterviewScheduleRequest(
    @NotBlank String candidateId,
    String jobId,
    String interviewer,
    String interviewType,       // Technical | HR | Final Round | Casual Chat
    @NotNull Instant scheduledAt,
    Integer durationMinutes,
    String location,            // Google Meet | In Office | Zoom | Phone
    String meetingLink,
    String notes
) {}
