package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
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

    private ClientResponse client(String name, String email, String title) {
        return new ClientResponse(
                42L, "login-1", "Nolyvra", null, null, null,
                name, email, title, null, null, null, null,
                Instant.now(), 0, 0, 0, List.of(), List.of());
    }
}
