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
        putIfPresent(properties, "industry", client.industry());
        putIfPresent(properties, "description", client.notes());
        putIfPresent(properties, "linkedin_company_page", client.linkedinUrl());

        // location is free-form and cannot be safely split into HubSpot's
        // city/state/country fields. companySize may not be numeric, so it is
        // not mapped to numberofemployees.
        return properties;
    }

    private void putIfPresent(Map<String, String> properties, String key, String value) {
        if (value != null && !value.isBlank()) {
            properties.put(key, value.trim());
        }
    }
}
