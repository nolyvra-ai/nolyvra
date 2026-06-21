package com.nolyvra.app.model;

import java.util.List;

public record XeroInvoiceCreateRequest(
        Long clientId,
        String contactName,
        String contactEmail,
        List<XeroInvoiceLineItemRequest> lineItems,
        String currency,
        String invoiceDate,
        String dueDate,
        String reference,
        String status,
        boolean sendEmail
) {}
