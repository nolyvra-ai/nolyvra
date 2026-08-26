package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.EmployeeResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HubSpotContactMapperTest {

    private final HubSpotContactMapper mapper = new HubSpotContactMapper();

    @Test
    void mapsEmailNameTitleAndPhoneToStandardContactProperties() {
        Map<String, String> properties = mapper.fromClient(
                client("  Ada   Lovelace ", " ADA@Example.COM ", " CTO ", " +61 400 111 222 "));

        assertThat(properties).containsEntry("email", "ada@example.com")
                .containsEntry("firstname", "Ada")
                .containsEntry("lastname", "Lovelace")
                .containsEntry("jobtitle", "CTO")
                .containsEntry("phone", "+61 400 111 222");
    }

    @Test
    void keepsSingleNameAsFirstNameAndOmitsMissingEmail() {
        Map<String, String> properties = mapper.fromClient(client("Prince", " ", null, null));

        assertThat(properties).containsOnly(Map.entry("firstname", "Prince"));
    }

    @Test
    void mapsEmployeeToStandardContactProperties() {
        Map<String, String> properties = mapper.fromEmployee(employee());

        assertThat(properties).containsEntry("email", "ada@example.com")
                .containsEntry("firstname", "Ada")
                .containsEntry("lastname", "Lovelace")
                .containsEntry("phone", "+61 400 000 000")
                .containsEntry("jobtitle", "Engineer");
    }

    private ClientResponse client(String name, String email, String title, String phone) {
        return new ClientResponse(
                42L, "login-1", "Nolyvra", null, null, null,
                name, email, title, phone, null,
                null, null, null, null, null, null, null, null, null,
                List.of(), null, null, null,
                Instant.now(), 0, 0, 0, List.of(), List.of(), "CLIENT", null, null, null);
    }

    private EmployeeResponse employee() {
        return new EmployeeResponse(
                "emp-1", "login-1", null, " Ada ", " Lovelace ",
                " ADA@Example.COM ", " +61 400 000 000 ", " Engineer ",
                "PERMANENT", "ACTIVE", null, null, "dept-1", "Engineering",
                LocalDate.now(), null, BigDecimal.TEN, null, null,
                Instant.now(), Instant.now());
    }
}
