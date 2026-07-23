package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;

public record ClientInvoiceResponse(
        Long id,
        String xeroInvoiceNumber,
        String status,
        String currency,
        BigDecimal total,
        Instant createdAt
) {}
