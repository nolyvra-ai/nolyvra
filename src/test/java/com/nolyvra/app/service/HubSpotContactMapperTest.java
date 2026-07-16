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
    void mapsEmailNameAndTitleToStandardContactProperties() {
        Map<String, String> properties = mapper.fromClient(
                client("  Ada   Lovelace ", " ADA@Example.COM ", " CTO "));

        assertThat(properties).containsEntry("email", "ada@example.com")
                .containsEntry("firstname", "Ada")
                .containsEntry("lastname", "Lovelace")
                .containsEntry("jobtitle", "CTO");
    }

    @Test
    void keepsSingleNameAsFirstNameAndOmitsMissingEmail() {
        Map<String, String> properties = mapper.fromClient(client("Prince", " ", null));

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

    private ClientResponse client(String name, String email, String title) {
        return new ClientResponse(
                42L, "login-1", "Nolyvra", null, null, null,
                name, email, title, null, null, null, null,
                Instant.now(), 0, 0, 0, List.of(), List.of());
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
