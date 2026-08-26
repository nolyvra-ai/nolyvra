package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.AdminContactListContact;
import com.nolyvra.app.model.AdminContactListWorkspace;
import com.nolyvra.app.service.AdminContactListService;
import com.nolyvra.app.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminContactListControllerTest {

    @Mock private AdminContactListService contactListService;
    @Mock private UserService userService;
    @Mock private SessionContext sessionContext;

    private AdminContactListController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminContactListController(contactListService, userService, sessionContext);
    }

    @Test
    void loadsWorkspaceForAuthenticatedAdmin() {
        AdminContactListWorkspace workspace = new AdminContactListWorkspace(
                "master.csv", 2, null, null, List.of());
        when(sessionContext.loginId()).thenReturn("admin@nolyvra.com");
        when(userService.isAdmin("admin@nolyvra.com")).thenReturn(true);
        when(contactListService.getWorkspace("admin@nolyvra.com")).thenReturn(workspace);

        assertEquals(workspace, controller.getWorkspace());
        verify(contactListService).getWorkspace("admin@nolyvra.com");
    }

    @Test
    void rejectsNonAdminAccounts() {
        when(sessionContext.loginId()).thenReturn("user@example.com");
        when(userService.isAdmin("user@example.com")).thenReturn(false);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class, controller::getWorkspace);

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    void savesContactForAuthenticatedAdmin() {
        AdminContactListContact contact = new AdminContactListContact(
                "123e4567-e89b-12d3-a456-426614174000", "Acme", "Ethan", "ethan@example.com",
                "", "", "", "", "", "",
                "27.05.26", "28.05.26", "30.05.26", "Book demo", "Growth ($199)", "$199",
                "", "Interested prospects", "Unknown",
                true, false, true, List.of());
        when(sessionContext.loginId()).thenReturn("admin@nolyvra.com");
        when(userService.isAdmin("admin@nolyvra.com")).thenReturn(true);
        when(contactListService.updateContact("admin@nolyvra.com", contact.id(), contact))
                .thenReturn(contact);

        assertEquals(contact, controller.updateContact(contact.id(), contact));
        verify(contactListService).updateContact("admin@nolyvra.com", contact.id(), contact);
    }
}
