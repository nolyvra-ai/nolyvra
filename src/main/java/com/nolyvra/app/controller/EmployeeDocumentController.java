package com.nolyvra.app.controller;

import com.nolyvra.app.model.EmployeeDocumentResponse;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.EmployeeDocumentService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Base64;
import java.util.List;

@RestController
@RequestMapping("/api/crm/employees/{employeeId}/documents")
public class EmployeeDocumentController {

    private final EmployeeDocumentService documentService;
    private final CrmEntitlementService   entitlementService;

    public EmployeeDocumentController(EmployeeDocumentService documentService,
                                      CrmEntitlementService entitlementService) {
        this.documentService   = documentService;
        this.entitlementService = entitlementService;
    }

    @GetMapping
    public List<EmployeeDocumentResponse> list(
            @PathVariable String employeeId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return documentService.list(employeeId, loginId);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeeDocumentResponse upload(
            @PathVariable String employeeId,
            @RequestParam String loginId,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) String docType,
            @RequestParam(required = false) String fileName,
            @RequestParam(required = false) String expiryDate) {
        entitlementService.checkEntitled(loginId);
        LocalDate expiry = (expiryDate != null && !expiryDate.isBlank())
                           ? LocalDate.parse(expiryDate) : null;
        return documentService.upload(employeeId, file, docType, fileName, expiry, loginId);
    }

    @GetMapping("/{docId}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable String employeeId,
            @PathVariable String docId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        String[] result   = documentService.download(docId, loginId);
        String   fileName = result[0];
        byte[]   bytes    = Base64.getDecoder().decode(result[1]);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    @DeleteMapping("/{docId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable String employeeId,
            @PathVariable String docId,
            @RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        documentService.delete(employeeId, docId, loginId);
    }
}
