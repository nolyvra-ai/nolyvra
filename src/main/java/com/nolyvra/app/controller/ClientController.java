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

    @GetMapping("/potential")
    public ResponseEntity<List<PotentialClientResponse>> getPotentialClients(@RequestParam String loginId) {
        return ResponseEntity.ok(clientService.getPotentialClients(loginId));
    }

    @PostMapping("/outreach")
    public ResponseEntity<String> generateOutreach(
            @RequestParam String loginId,
            @RequestBody OutreachRequest req) {
        return ResponseEntity.ok(clientService.generateOutreachMessage(loginId, req));
    }
}
