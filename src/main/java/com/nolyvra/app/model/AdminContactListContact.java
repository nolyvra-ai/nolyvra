package com.nolyvra.app.model;

import java.util.List;

public record AdminContactListContact(
        String id,
        String company,
        String name,
        String email,
        String phone,
        String role,
        String segment,
        String source,
        String owner,
        String stage,
        String dateAdded,
        String lastContact,
        String nextActionDate,
        String nextStep,
        String packageName,
        String potentialMrr,
        String notes,
        String category,
        String consentStatus,
        boolean hasValidEmail,
        boolean isDuplicate,
        boolean edited,
        List<String> issues) {
}
