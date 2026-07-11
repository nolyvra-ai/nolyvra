package com.nolyvra.app.model;

import java.time.OffsetDateTime;
import java.util.List;

public record StackAuditLeadResponse(
        long id,
        String fullName,
        String companyName,
        String email,
        String phone,
        OffsetDateTime createdAt,
        boolean demoRequested,
        Report report
) {
    public record Report(
            CategoryLine candidateSearch,
            CategoryLine ats,
            CategoryLine crm,
            CategoryLine aiAndAgent,
            int totalCurrentMonthly,
            int totalNolyvraMonthly,
            int totalMonthlySaving,
            int totalAnnualisedSaving,
            int savingPercent,
            String narrative,
            List<InputSnapshot> inputs
    ) {}

    public record CategoryLine(
            String label,
            int currentMonthly,
            int nolyvraMonthly,
            int saving,
            String assumption
    ) {}

    public record InputSnapshot(
            List<StackAuditRequest.CandidateTool> candidateTools,
            String atsTool,
            int atsExpense,
            List<String> atsFeatures,
            String crmTool,
            int crmExpense,
            List<String> crmFeatures,
            List<StackAuditRequest.AiTool> aiTools,
            boolean usesAiAgent,
            Integer aiAgentExpense
    ) {}
}
