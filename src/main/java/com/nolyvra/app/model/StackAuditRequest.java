package com.nolyvra.app.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.util.List;

public record StackAuditRequest(

        @NotBlank(message = "Full name is required")
        String fullName,

        @NotBlank(message = "Company name is required")
        String companyName,

        @NotBlank(message = "Work email is required")
        @Email(message = "A valid email address is required")
        String email,

        @NotBlank(message = "Phone number is required")
        String phone,

        @NotNull(message = "Candidate tools list is required")
        List<@Valid CandidateTool> candidateTools,

        @NotBlank(message = "ATS tool name is required")
        String atsTool,

        @Min(value = 0, message = "ATS expense cannot be negative")
        int atsExpense,

        @NotNull(message = "ATS features list is required")
        List<String> atsFeatures,

        @NotBlank(message = "CRM/HRM tool name is required")
        String crmTool,

        @Min(value = 0, message = "CRM expense cannot be negative")
        int crmExpense,

        @NotNull(message = "CRM features list is required")
        List<String> crmFeatures,

        @NotNull(message = "AI tools list is required")
        List<@Valid AiTool> aiTools,

        boolean usesAiAgent,

        Integer aiAgentExpense,

        @AssertTrue(message = "Consent is required to submit")
        boolean consent
) {

    public record CandidateTool(
            @NotBlank String name,
            @Min(0) int expense
    ) {}

    public record AiTool(
            @NotBlank String name,
            @Min(0) int expense
    ) {}
}
