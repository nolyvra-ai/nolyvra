package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HubSpotCompanyMapperTest {

    private final HubSpotCompanyMapper mapper = new HubSpotCompanyMapper();

    @Test
    void mapsOnlyCompatibleStandardCompanyProperties() {
        ClientResponse client = new ClientResponse(
                42L, "login-1", " Nolyvra ", "Software", "11-50", "Melbourne, VIC",
                null, null, null, null, "https://linkedin.com/company/nolyvra", List.of(), "Recruitment platform",
                null, null, Instant.now(), 0, 0, 0, List.of(), List.of());

        Map<String, String> properties = mapper.fromClient(client);

        assertThat(properties).containsEntry("name", "Nolyvra")
                .containsEntry("description", "Recruitment platform")
                .containsEntry("linkedin_company_page", "https://linkedin.com/company/nolyvra")
                .doesNotContainKeys("industry", "location", "company_size", "numberofemployees");
    }

    @Test
    void omitsBlankOptionalProperties() {
        ClientResponse client = new ClientResponse(
                42L, "login-1", "Nolyvra", " ", null, null,
                null, null, null, null, null, List.of(), null, null, null,
                Instant.now(), 0, 0, 0, List.of(), List.of());

        assertThat(mapper.fromClient(client)).containsOnly(Map.entry("name", "Nolyvra"));
    }
}
