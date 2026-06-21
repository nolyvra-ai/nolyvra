package com.nolyvra.app.model;

import java.util.List;

public record XeroInvoiceConfigResponse(
        boolean configAvailable,
        List<AccountOption> accounts,
        List<TaxRateOption> taxRates,
        String baseCurrency,
        String defaultAccountCode,
        String defaultTaxType
) {
    public record AccountOption(String code, String name) {}
    public record TaxRateOption(String taxType, String name, Double rate) {}
}
