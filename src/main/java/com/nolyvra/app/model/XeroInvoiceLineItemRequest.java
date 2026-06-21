package com.nolyvra.app.model;

import java.math.BigDecimal;

public record XeroInvoiceLineItemRequest(
        String jobId,
        String candidateName,
        String description,
        BigDecimal amount,
        String accountCode,
        String taxType
) {}
