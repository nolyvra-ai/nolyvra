package com.nolyvra.app.service;

import com.nolyvra.app.model.BillablePlacementResponse;
import com.nolyvra.app.model.XeroConnection;
import com.nolyvra.app.model.XeroInvoiceConfigResponse;
import com.nolyvra.app.model.XeroInvoiceCreateRequest;
import com.nolyvra.app.model.XeroInvoiceCreateResponse;
import com.nolyvra.app.model.XeroInvoiceLineItemRequest;
import com.xero.api.ApiClient;
import com.xero.api.client.AccountingApi;
import com.xero.models.accounting.Account;
import com.xero.models.accounting.AccountType;
import com.xero.models.accounting.Accounts;
import com.xero.models.accounting.Contact;
import com.xero.models.accounting.CurrencyCode;
import com.xero.models.accounting.Invoice;
import com.xero.models.accounting.Invoices;
import com.xero.models.accounting.LineItem;
import com.xero.models.accounting.Organisations;
import com.xero.models.accounting.RequestEmpty;
import com.xero.models.accounting.TaxRate;
import com.xero.models.accounting.TaxRates;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class XeroInvoiceService {

    private static final Logger log = LoggerFactory.getLogger(XeroInvoiceService.class);

    private final JdbcTemplate jdbc;
    private final XeroOAuthService xeroOAuthService;
    private final AccountingApi accountingApi;
    private final TransactionTemplate transactionTemplate;

    public XeroInvoiceService(
            JdbcTemplate jdbc,
            XeroOAuthService xeroOAuthService,
            PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.xeroOAuthService = xeroOAuthService;
        this.accountingApi = new AccountingApi(new ApiClient());
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    // ─── GET /api/xero/invoice-config ──────────────────────────────────────────

    public XeroInvoiceConfigResponse getInvoiceConfig(String loginId) {
        try {
            XeroConnection connection = xeroOAuthService.getConnection(loginId);
            if (connection == null) return unavailableConfig();

            String tenantId = connection.xeroTenantId();
            String accessToken = xeroOAuthService.getValidAccessToken(loginId, tenantId);
            if (accessToken == null) return unavailableConfig();

            Accounts accountsResp = accountingApi.getAccounts(accessToken, tenantId, null, null, null);
            List<Account> activeRevenueAccounts = (accountsResp.getAccounts() == null
                    ? List.<Account>of() : accountsResp.getAccounts())
                    .stream()
                    .filter(a -> a.getStatus() == Account.StatusEnum.ACTIVE)
                    .filter(a -> a.getType() == AccountType.REVENUE || a.getType() == AccountType.SALES)
                    .toList();

            TaxRates taxRatesResp = accountingApi.getTaxRates(accessToken, tenantId, null, null);
            List<TaxRate> activeTaxRates = (taxRatesResp.getTaxRates() == null
                    ? List.<TaxRate>of() : taxRatesResp.getTaxRates())
                    .stream()
                    .filter(t -> t.getStatus() == TaxRate.StatusEnum.ACTIVE)
                    .toList();

            Organisations orgsResp = accountingApi.getOrganisations(accessToken, tenantId);
            String baseCurrency = (orgsResp.getOrganisations() == null || orgsResp.getOrganisations().isEmpty())
                    ? null
                    : String.valueOf(orgsResp.getOrganisations().get(0).getBaseCurrency());

            List<XeroInvoiceConfigResponse.AccountOption> accountOptions = activeRevenueAccounts.stream()
                    .map(a -> new XeroInvoiceConfigResponse.AccountOption(a.getCode(), a.getName()))
                    .toList();
            List<XeroInvoiceConfigResponse.TaxRateOption> taxRateOptions = activeTaxRates.stream()
                    .map(t -> new XeroInvoiceConfigResponse.TaxRateOption(t.getTaxType(), t.getName(), t.getEffectiveRate()))
                    .toList();

            String defaultAccountCode = activeRevenueAccounts.isEmpty() ? null : activeRevenueAccounts.get(0).getCode();
            String defaultTaxType = activeTaxRates.stream()
                    .filter(t -> "GST on Income".equalsIgnoreCase(t.getName()))
                    .map(TaxRate::getTaxType)
                    .findFirst()
                    .orElse(null);

            return new XeroInvoiceConfigResponse(
                    true, accountOptions, taxRateOptions, baseCurrency, defaultAccountCode, defaultTaxType);
        } catch (Exception e) {
            // Never error here - the brief requires a graceful editable-fallback UI
            // instead of a hard failure when Xero isn't connected or the call fails.
            log.warn("[XeroInvoice] invoice-config unavailable for loginId={}: {}", loginId, e.getMessage());
            return unavailableConfig();
        }
    }

    private static XeroInvoiceConfigResponse unavailableConfig() {
        return new XeroInvoiceConfigResponse(false, List.of(), List.of(), null, null, null);
    }

    // ─── GET /api/clients/{id}/billable-placements ─────────────────────────────

    public List<BillablePlacementResponse> getBillablePlacements(Long clientId, String loginId) {
        String companyName = resolveClientCompanyName(clientId, loginId);
        return jdbc.query("""
                SELECT id, title, currency, salary, fee_percentage
                FROM jobs
                WHERE login_id = ? AND lower(company) = lower(?)
                  AND lower(status) = 'complete' AND xero_invoice_id IS NULL
                ORDER BY created_at DESC
                """,
                (rs, i) -> {
                    BigDecimal salary = rs.getBigDecimal("salary");
                    BigDecimal feePercentage = rs.getBigDecimal("fee_percentage");
                    return new BillablePlacementResponse(
                            rs.getString("id"),
                            rs.getString("title"),
                            rs.getString("currency"),
                            salary,
                            feePercentage,
                            computeEstimatedFee(salary, feePercentage));
                },
                loginId, companyName);
    }

    private String resolveClientCompanyName(Long clientId, String loginId) {
        return jdbc.query(
                "SELECT company_name FROM clients WHERE id = ? AND login_id = ?",
                (rs, i) -> rs.getString("company_name"), clientId, loginId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));
    }

    private static BigDecimal computeEstimatedFee(BigDecimal salary, BigDecimal feePercentage) {
        if (salary == null || feePercentage == null) return null;
        return salary.multiply(feePercentage)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    // ─── POST /api/xero/invoices ────────────────────────────────────────────────

    public XeroInvoiceCreateResponse createInvoice(XeroInvoiceCreateRequest req, String loginId) {
        if (req.lineItems() == null || req.lineItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one line item is required");
        }
        if (!"DRAFT".equals(req.status()) && !"AUTHORISED".equals(req.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be DRAFT or AUTHORISED");
        }
        if ("AUTHORISED".equals(req.status()) && req.sendEmail()
                && (req.contactEmail() == null || req.contactEmail().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A contact email is required to authorise and send an invoice");
        }
        if (req.currency() == null || req.currency().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "currency is required");
        }

        List<String> jobIds = req.lineItems().stream().map(XeroInvoiceLineItemRequest::jobId).toList();

        // Server-side re-check: every jobId must still belong to this agency,
        // still be Complete, not already invoiced, and share the invoice currency.
        // Guards against double-submit and mixed-currency invoices.
        List<JobRow> jobRows = fetchJobRows(jobIds, loginId);
        if (jobRows.size() != jobIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more placements were not found");
        }
        for (JobRow row : jobRows) {
            if (row.xeroInvoiceId() != null || !"complete".equalsIgnoreCase(row.status())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Placement " + row.id() + " is no longer billable (already invoiced or not Complete)");
            }
            if (!req.currency().equalsIgnoreCase(row.currency())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Line items have mixed currencies: " + req.currency() + " and " + row.currency()
                                + " — Xero invoices must be single-currency");
            }
        }

        XeroConnection connection = xeroOAuthService.getConnection(loginId);
        if (connection == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Not connected to Xero");
        }
        String tenantId = connection.xeroTenantId();
        String accessToken;
        try {
            accessToken = xeroOAuthService.getValidAccessToken(loginId, tenantId);
        } catch (XeroOAuthService.XeroReconnectRequiredException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Xero reconnect required");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to obtain a valid Xero token");
        }
        if (accessToken == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Not connected to Xero");
        }

        Invoice invoice;
        try {
            Contact contact = new Contact()
                    .name(req.contactName())
                    .emailAddress(req.contactEmail());

            List<LineItem> lineItems = req.lineItems().stream()
                    .map(li -> new LineItem()
                            .description(li.description())
                            .quantity(1.0)
                            .unitAmount(li.amount() != null ? li.amount().doubleValue() : 0.0)
                            .accountCode(li.accountCode())
                            .taxType(li.taxType()))
                    .toList();

            invoice = new Invoice()
                    .type(Invoice.TypeEnum.ACCREC)
                    .contact(contact)
                    .lineItems(lineItems)
                    .date(req.invoiceDate())
                    .dueDate(req.dueDate())
                    .reference(req.reference())
                    .status("AUTHORISED".equals(req.status()) ? Invoice.StatusEnum.AUTHORISED : Invoice.StatusEnum.DRAFT)
                    .currencyCode(CurrencyCode.valueOf(req.currency()));

            Invoices invoices = new Invoices().invoices(List.of(invoice));
            Invoices result = accountingApi.createInvoices(
                    accessToken, tenantId, invoices, false, null, UUID.randomUUID().toString());

            if (result.getInvoices() == null || result.getInvoices().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Xero did not return a created invoice");
            }
            invoice = result.getInvoices().get(0);

            if ("AUTHORISED".equals(req.status()) && req.sendEmail()) {
                accountingApi.emailInvoice(
                        accessToken, tenantId, invoice.getInvoiceID(), new RequestEmpty(),
                        UUID.randomUUID().toString());
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Xero invoice creation failed: " + e.getMessage());
        }

        String xeroInvoiceId = invoice.getInvoiceID().toString();
        String invoiceNumber = invoice.getInvoiceNumber();
        String resultStatus = String.valueOf(invoice.getStatus());
        BigDecimal total = req.lineItems().stream()
                .map(XeroInvoiceLineItemRequest::amount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        try {
            transactionTemplate.executeWithoutResult(status ->
                    stampInvoice(loginId, req.clientId(), xeroInvoiceId, invoiceNumber, req.status(),
                            req.currency(), total, jobIds));
        } catch (Exception e) {
            // The invoice now exists in Xero but our DB write failed - this is a real
            // inconsistency that needs manual reconciliation, never silently dropped.
            log.error("[XeroInvoice] DB write failed AFTER Xero invoice was created — "
                            + "RECONCILIATION NEEDED. xeroInvoiceId={} loginId={} jobIds={}",
                    xeroInvoiceId, loginId, jobIds, e);
            throw e;
        }

        String deepLink = "https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=" + xeroInvoiceId;
        return new XeroInvoiceCreateResponse(xeroInvoiceId, invoiceNumber, resultStatus, deepLink);
    }

    private void stampInvoice(String loginId, Long clientId, String xeroInvoiceId, String invoiceNumber,
                               String status, String currency, BigDecimal total, List<String> jobIds) {
        Long xeroInvoiceRowId = jdbc.queryForObject("""
                INSERT INTO xero_invoice
                    (login_id, client_id, xero_invoice_id, xero_invoice_number, status, currency, total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                loginId, clientId, xeroInvoiceId, invoiceNumber, status, currency, total);

        String placeholders = String.join(",", Collections.nCopies(jobIds.size(), "?"));
        List<Object> params = new ArrayList<>();
        params.add(xeroInvoiceRowId);
        params.add(loginId);
        params.addAll(jobIds);
        jdbc.update(
                "UPDATE jobs SET xero_invoice_id = ?, invoiced_at = now() "
                        + "WHERE login_id = ? AND id IN (" + placeholders + ")",
                params.toArray());
    }

    private List<JobRow> fetchJobRows(List<String> jobIds, String loginId) {
        if (jobIds.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(jobIds.size(), "?"));
        List<Object> params = new ArrayList<>();
        params.add(loginId);
        params.addAll(jobIds);
        return jdbc.query(
                "SELECT id, status, currency, xero_invoice_id FROM jobs WHERE login_id = ? AND id IN (" + placeholders + ")",
                (rs, i) -> new JobRow(
                        rs.getString("id"),
                        rs.getString("status"),
                        rs.getString("currency"),
                        rs.getObject("xero_invoice_id", Long.class)),
                params.toArray());
    }

    private record JobRow(String id, String status, String currency, Long xeroInvoiceId) {}
}
