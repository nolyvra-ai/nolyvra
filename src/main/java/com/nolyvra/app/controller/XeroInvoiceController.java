package com.nolyvra.app.controller;

import com.nolyvra.app.model.XeroInvoiceConfigResponse;
import com.nolyvra.app.model.XeroInvoiceCreateRequest;
import com.nolyvra.app.model.XeroInvoiceCreateResponse;
import com.nolyvra.app.service.XeroInvoiceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/xero")
public class XeroInvoiceController {

    private final XeroInvoiceService xeroInvoiceService;

    public XeroInvoiceController(XeroInvoiceService xeroInvoiceService) {
        this.xeroInvoiceService = xeroInvoiceService;
    }

    @GetMapping("/invoice-config")
    public ResponseEntity<XeroInvoiceConfigResponse> invoiceConfig(@RequestParam String loginId) {
        return ResponseEntity.ok(xeroInvoiceService.getInvoiceConfig(loginId));
    }

    @PostMapping("/invoices")
    public ResponseEntity<XeroInvoiceCreateResponse> createInvoice(
            @RequestParam String loginId,
            @RequestBody XeroInvoiceCreateRequest req) {
        return ResponseEntity.ok(xeroInvoiceService.createInvoice(req, loginId));
    }
}
