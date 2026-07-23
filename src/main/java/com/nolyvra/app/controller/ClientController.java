package com.nolyvra.app.controller;

import com.nolyvra.app.model.BillablePlacementResponse;
import com.nolyvra.app.model.ClientCandidateResponse;
import com.nolyvra.app.model.ClientFileResponse;
import com.nolyvra.app.model.ClientInvoiceResponse;
import com.nolyvra.app.model.ClientNoteRequest;
import com.nolyvra.app.model.ClientNoteResponse;
import com.nolyvra.app.model.ClientRequest;
import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.ContactResponse;
import com.nolyvra.app.model.EmailHistoryResponse;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import com.nolyvra.app.model.OutreachRequest;
import com.nolyvra.app.model.PotentialClientResponse;
import com.nolyvra.app.service.ClientService;
import com.nolyvra.app.service.ContactService;
import com.nolyvra.app.service.HubSpotClientSyncService;
import com.nolyvra.app.service.XeroInvoiceService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;
    private final ContactService contactService;
    private final XeroInvoiceService xeroInvoiceService;
    private final HubSpotClientSyncService hubSpotClientSyncService;

    public ClientController(
            ClientService clientService,
            ContactService contactService,
            XeroInvoiceService xeroInvoiceService,
            HubSpotClientSyncService hubSpotClientSyncService) {
        this.clientService = clientService;
        this.contactService = contactService;
        this.xeroInvoiceService = xeroInvoiceService;
        this.hubSpotClientSyncService = hubSpotClientSyncService;
    }

    @GetMapping
    public ResponseEntity<List<ClientResponse>> getClients(@RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClients(loginId));
    }

    @PostMapping
    public ResponseEntity<ClientResponse> createClient(
            @RequestParam String loginId,
            @RequestBody ClientRequest req) {
        return ResponseEntity.ok(clientService.createClient(req, loginId));
    }

    @PostMapping("/convert-lead")
    public ResponseEntity<ClientResponse> convertLeadToClient(
            @RequestParam String loginId,
            @RequestBody ClientRequest req) {
        return ResponseEntity.ok(clientService.convertLeadToClient(req, loginId));
    }

    @GetMapping("/{id}/contacts")
    public ResponseEntity<List<ContactResponse>> getClientContacts(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(contactService.getClientContacts(id, loginId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClientResponse> updateClient(
            @PathVariable Long id,
            @RequestParam String loginId,
            @RequestBody ClientRequest req) {
        return ResponseEntity.ok(clientService.updateClient(id, req, loginId));
    }

    @GetMapping("/{id}/jobs")
    public ResponseEntity<List<ClientResponse.JobSummary>> getClientJobs(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientJobsById(id, loginId));
    }

    @GetMapping("/{id}/notes")
    public ResponseEntity<List<ClientNoteResponse>> getClientNotes(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientNotes(id, loginId));
    }

    @PostMapping("/{id}/notes")
    public ResponseEntity<List<ClientNoteResponse>> addClientNote(
            @PathVariable Long id,
            @RequestParam String loginId,
            @RequestBody ClientNoteRequest req) {
        return ResponseEntity.ok(clientService.addClientNote(id, loginId, req.note()));
    }

    @GetMapping("/{id}/billable-placements")
    public ResponseEntity<List<BillablePlacementResponse>> getBillablePlacements(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(xeroInvoiceService.getBillablePlacements(id, loginId));
    }

    @GetMapping("/{id}/emails")
    public ResponseEntity<List<EmailHistoryResponse>> getClientEmails(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientEmails(id, loginId));
    }

    @GetMapping("/{id}/invoices")
    public ResponseEntity<List<ClientInvoiceResponse>> getClientInvoices(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientInvoices(id, loginId));
    }

    @GetMapping("/{id}/candidates-pitched")
    public ResponseEntity<List<ClientCandidateResponse>> getCandidatesPitched(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientCandidatesPitched(id, loginId));
    }

    @GetMapping("/{id}/candidates-employed")
    public ResponseEntity<List<ClientCandidateResponse>> getCandidatesEmployed(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientCandidatesEmployed(id, loginId));
    }

    // ─── Files ────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/files")
    public ResponseEntity<List<ClientFileResponse>> getClientFiles(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getClientFiles(id, loginId));
    }

    @PostMapping(value = "/{id}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClientFileResponse> uploadClientFile(
            @PathVariable Long id,
            @RequestParam String loginId,
            @RequestParam MultipartFile file) {
        return ResponseEntity.ok(clientService.uploadClientFile(id, loginId, file));
    }

    @GetMapping("/{id}/files/{fileId}")
    public ResponseEntity<byte[]> downloadClientFile(
            @PathVariable Long id,
            @PathVariable Long fileId,
            @RequestParam String loginId) {
        Map<String, Object> raw = clientService.getClientFileRaw(id, fileId, loginId);
        byte[] data = (byte[]) raw.get("file_data");
        String name = (String) raw.get("file_name");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @DeleteMapping("/{id}/files/{fileId}")
    public ResponseEntity<Void> deleteClientFile(
            @PathVariable Long id,
            @PathVariable Long fileId,
            @RequestParam String loginId) {
        clientService.deleteClientFile(id, fileId, loginId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/hubspot/push")
    public ResponseEntity<HubSpotSyncStatusResponse> pushClientToHubSpot(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(hubSpotClientSyncService.pushClient(id, loginId));
    }

    @PostMapping("/{id}/hubspot/sync")
    public ResponseEntity<HubSpotSyncStatusResponse> syncClientWithHubSpot(
            @PathVariable Long id,
            @RequestParam String loginId,
            @RequestParam(required = false, defaultValue = "auto") String direction) {
        return ResponseEntity.ok(hubSpotClientSyncService.syncClient(id, loginId, direction));
    }

    @GetMapping("/{id}/hubspot/status")
    public ResponseEntity<HubSpotSyncStatusResponse> getClientHubSpotStatus(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(hubSpotClientSyncService.getStatus(id, loginId));
    }

    @GetMapping("/potential")
    public ResponseEntity<List<PotentialClientResponse>> getPotentialClients(
            @RequestParam String loginId,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String place,
            @RequestParam(required = false) String companySize,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(clientService.getPotentialClients(loginId, industry, place, companySize, keyword));
    }

    @GetMapping("/potential/load-more")
    public ResponseEntity<List<PotentialClientResponse>> loadMoreClients(
            @RequestParam String loginId,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String place,
            @RequestParam(required = false) String companySize,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(clientService.loadMoreClients(loginId, industry, place, companySize, keyword));
    }

    @PostMapping("/outreach")
    public ResponseEntity<String> generateOutreach(
            @RequestParam String loginId,
            @RequestBody OutreachRequest req) {
        return ResponseEntity.ok(clientService.generateOutreachMessage(loginId, req));
    }
}
