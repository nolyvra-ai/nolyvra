package com.nolyvra.app.service;

import com.nolyvra.app.model.ClientResponse;
import com.nolyvra.app.model.EmployeeResponse;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class HubSpotContactMapper {

    public Map<String, String> fromClient(ClientResponse client) {
        Map<String, String> properties = new LinkedHashMap<>();
        putIfPresent(properties, "email", normalizeEmail(client.contactEmail()));
        putIfPresent(properties, "jobtitle", client.contactTitle());
        putIfPresent(properties, "phone", client.contactPhone());

        String name = trimToNull(client.contactPerson());
        if (name != null) {
            int separator = name.indexOf(' ');
            if (separator < 0) {
                properties.put("firstname", name);
            } else {
                properties.put("firstname", name.substring(0, separator));
                putIfPresent(properties, "lastname", name.substring(separator + 1));
            }
        }
        return properties;
    }

    public Map<String, String> fromEmployee(EmployeeResponse employee) {
        Map<String, String> properties = new LinkedHashMap<>();
        putIfPresent(properties, "email", normalizeEmail(employee.email()));
        putIfPresent(properties, "firstname", employee.firstName());
        putIfPresent(properties, "lastname", employee.lastName());
        putIfPresent(properties, "phone", employee.phone());
        putIfPresent(properties, "jobtitle", employee.jobTitle());
        return properties;
    }

    private String normalizeEmail(String email) {
        String value = trimToNull(email);
        return value == null ? null : value.toLowerCase();
    }

    private void putIfPresent(Map<String, String> properties, String key, String value) {
        String normalized = trimToNull(value);
        if (normalized != null) properties.put(key, normalized);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim().replaceAll("\\s+", " ");
    }
}
