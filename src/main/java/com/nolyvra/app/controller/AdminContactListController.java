package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.AdminContactListContact;
import com.nolyvra.app.model.AdminContactListImportRequest;
import com.nolyvra.app.model.AdminContactListWorkspace;
import com.nolyvra.app.service.AdminContactListService;
import com.nolyvra.app.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth/admin/contact-list")
public class AdminContactListController {

    private final AdminContactListService contactListService;
    private final UserService userService;
    private final SessionContext sessionContext;

    public AdminContactListController(
            AdminContactListService contactListService,
            UserService userService,
            SessionContext sessionContext) {
        this.contactListService = contactListService;
        this.userService = userService;
        this.sessionContext = sessionContext;
    }

    @GetMapping
    public AdminContactListWorkspace getWorkspace() {
        return contactListService.getWorkspace(requireAdmin());
    }

    @PutMapping
    public AdminContactListWorkspace mergeWorkspace(@RequestBody AdminContactListImportRequest request) {
        return contactListService.mergeWorkspace(requireAdmin(), request);
    }

    @PatchMapping("/contacts/{contactId}")
    public AdminContactListContact updateContact(
            @PathVariable String contactId,
            @RequestBody AdminContactListContact contact) {
        return contactListService.updateContact(requireAdmin(), contactId, contact);
    }

    private String requireAdmin() {
        String loginId = sessionContext.loginId();
        if (sessionContext.isEmployee() || loginId == null || !userService.isAdmin(loginId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
        }
        return loginId;
    }
}
