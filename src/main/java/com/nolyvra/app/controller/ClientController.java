package com.nolyvra.app.controller;

import com.nolyvra.app.model.BillablePlacementResponse;
import com.nolyvra.app.model.ClientRequest;
import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.HubSpotSyncStatusResponse;
import com.nolyvra.app.model.OutreachRequest;
import com.nolyvra.app.model.PotentialClientResponse;
import com.nolyvra.app.service.ClientService;
import com.nolyvra.app.service.HubSpotClientSyncService;
import com.nolyvra.app.service.XeroInvoiceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;
    private final XeroInvoiceService xeroInvoiceService;
    private final HubSpotClientSyncService hubSpotClientSyncService;

    public ClientController(
            ClientService clientService,
            XeroInvoiceService xeroInvoiceService,
            HubSpotClientSyncService hubSpotClientSyncService) {
        this.clientService = clientService;
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

    @GetMapping("/{id}/billable-placements")
    public ResponseEntity<List<BillablePlacementResponse>> getBillablePlacements(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(xeroInvoiceService.getBillablePlacements(id, loginId));
    }

    @PostMapping("/{id}/hubspot/push")
    public ResponseEntity<HubSpotSyncStatusResponse> pushClientToHubSpot(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return ResponseEntity.ok(hubSpotClientSyncService.pushClient(id, loginId));
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
