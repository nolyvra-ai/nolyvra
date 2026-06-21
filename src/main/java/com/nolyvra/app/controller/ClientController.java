package com.nolyvra.app.controller;

import com.nolyvra.app.model.ClientRequest;
import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.OutreachRequest;
import com.nolyvra.app.model.PotentialClientResponse;
import com.nolyvra.app.service.ClientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
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

    @GetMapping("/potential")
    public ResponseEntity<List<PotentialClientResponse>> getPotentialClients(
            @RequestParam String loginId,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String companySize,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(clientService.getPotentialClients(loginId, industry, country, companySize, keyword));
    }

    @PostMapping("/outreach")
    public ResponseEntity<String> generateOutreach(
            @RequestParam String loginId,
            @RequestBody OutreachRequest req) {
        return ResponseEntity.ok(clientService.generateOutreachMessage(loginId, req));
    }
}
