package com.nolyvra.app.model;

public record XeroInvoiceCreateResponse(
        String xeroInvoiceId,
        String invoiceNumber,
        String status,
        String deepLink
) {}
