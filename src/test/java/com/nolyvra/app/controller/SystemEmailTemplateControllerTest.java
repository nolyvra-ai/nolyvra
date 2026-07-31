package com.nolyvra.app.controller;

import com.nolyvra.app.model.SystemEmailTemplateUpdateRequest;
import com.nolyvra.app.service.SystemEmailTemplateService;
import com.nolyvra.app.service.UserService;
import com.nolyvra.app.service.ResendEmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SystemEmailTemplateControllerTest {

    private SystemEmailTemplateService service;
    private UserService users;
    private SystemEmailTemplateController controller;
    private ResendEmailService resend;

    @BeforeEach
    void setUp() {
        service = mock(SystemEmailTemplateService.class);
        users = mock(UserService.class);
        resend = mock(ResendEmailService.class);
        controller = new SystemEmailTemplateController(service, users, resend);
    }

    @Test
    void deniesNonAdministrators() {
        when(users.isAdmin("employee")).thenReturn(false);

        ResponseEntity<?> response = controller.list("employee");

        assertEquals(403, response.getStatusCode().value());
        verify(service, never()).list();
    }

    @Test
    void permitsAdministratorsToListAndRestore() {
        when(users.isAdmin("admin")).thenReturn(true);
        when(service.list()).thenReturn(List.of());

        assertEquals(200, controller.list("admin").getStatusCode().value());
        assertEquals(200, controller.restore("admin", 2L, "password_reset").getStatusCode().value());
        verify(service).restore("password_reset", 2L);
    }

    @Test
    void returnsBadRequestForInvalidTemplateKey() {
        when(users.isAdmin("admin")).thenReturn(true);
        when(service.get("unknown")).thenThrow(new IllegalArgumentException("Unknown template key."));

        assertEquals(400, controller.get("admin", "unknown").getStatusCode().value());
    }

    @Test
    void delegatesUpdatesWithAdministratorIdentity() {
        when(users.isAdmin("admin")).thenReturn(true);
        SystemEmailTemplateUpdateRequest request =
                new SystemEmailTemplateUpdateRequest("s", "h", "t", true, 0L);

        assertEquals(200, controller.update("admin", "password_reset", request).getStatusCode().value());
        verify(service).update("password_reset", request, "admin");
    }

    @Test
    void exposesOnlySafeResendConfigurationStatus() {
        when(users.isAdmin("admin")).thenReturn(true);
        when(resend.isConfigured()).thenReturn(true);

        ResponseEntity<?> response = controller.status("admin");

        assertEquals(200, response.getStatusCode().value());
        assertEquals(java.util.Map.of("resendConfigured", true), response.getBody());
    }
}
