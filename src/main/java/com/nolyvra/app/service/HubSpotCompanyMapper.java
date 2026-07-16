package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class HubSpotCompanyMapper {

    public Map<String, String> fromClient(ClientResponse client) {
        Map<String, String> properties = new LinkedHashMap<>();
        putIfPresent(properties, "name", client.companyName());
        putIfPresent(properties, "description", client.notes());
        putIfPresent(properties, "linkedin_company_page", client.linkedinUrl());

        // industry, location, and companySize are free-form in Nolyvra but
        // constrained or structured in HubSpot, so they are intentionally not
        // mapped until we have a controlled value mapping.
        return properties;
    }

    private void putIfPresent(Map<String, String> properties, String key, String value) {
        if (value != null && !value.isBlank()) {
            properties.put(key, value.trim());
        }
    }
}
