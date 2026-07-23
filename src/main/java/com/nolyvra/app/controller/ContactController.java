package com.nolyvra.app.controller;

import com.nolyvra.app.model.ContactCreateRequest;
import com.nolyvra.app.model.ContactFromLeadRequest;
import com.nolyvra.app.model.ContactResponse;
import com.nolyvra.app.model.ContactUpdateRequest;
import com.nolyvra.app.service.ContactService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping
    public List<ContactResponse> getAllContacts(@RequestParam String loginId) {
        return contactService.getAllContacts(loginId);
    }

    @PostMapping
    public ContactResponse createContact(
            @RequestParam String loginId,
            @Valid @RequestBody ContactCreateRequest req) {
        return contactService.createContact(req, loginId);
    }

    @PostMapping("/from-lead")
    public ContactResponse createContactFromLead(
            @RequestParam String loginId,
            @Valid @RequestBody ContactFromLeadRequest req) {
        return contactService.createContactFromLead(req, loginId);
    }

    @PutMapping("/{id}")
    public ContactResponse updateContact(
            @PathVariable Long id,
            @RequestParam String loginId,
            @Valid @RequestBody ContactUpdateRequest req) {
        return contactService.updateContact(id, req, loginId);
    }

    @GetMapping("/{id}")
    public ContactResponse getContact(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return contactService.getContact(id, loginId);
    }

    @PostMapping("/{id}/link-candidate")
    public ContactResponse linkToCandidate(
            @PathVariable Long id,
            @RequestParam String loginId) {
        return contactService.linkToCandidate(id, loginId);
    }

    @GetMapping("/by-candidate/{candidateId}")
    public ContactResponse getContactByCandidateId(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return contactService.getContactByCandidateId(candidateId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No contact linked to candidate: " + candidateId));
    }
}
