package com.nolyvra.app.model;

import java.time.Instant;
import java.time.LocalDate;

public record EmployeeDocumentResponse(
        String id,
        String employeeId,
        String docType,
        String fileName,
        LocalDate expiryDate,
        Instant uploadedAt
) {}
