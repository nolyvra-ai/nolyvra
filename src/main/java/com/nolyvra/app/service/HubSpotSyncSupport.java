package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.nolyvra.app.model.ExternalCrmLink;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

final class HubSpotSyncSupport {

    private HubSpotSyncSupport() {}

    static boolean isPull(String direction) {
        return "pull".equalsIgnoreCase(direction);
    }

    static boolean isPush(String direction) {
        return "push".equalsIgnoreCase(direction);
    }

    static String property(JsonNode properties, String key) {
        if (properties == null || properties.isMissingNode() || properties.isNull()) {
            return null;
        }
        JsonNode value = properties.path(key);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText(null);
        return text == null || text.isBlank() ? null : text.trim();
    }

    static boolean changedAfter(Instant changedAt, Instant baseline) {
        return changedAt != null && baseline != null && changedAt.isAfter(baseline);
    }

    static void requireLinked(ExternalCrmLink link, String localType) {
        if (link == null || link.externalId() == null || link.externalId().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Push this " + localType + " to HubSpot before running bidirectional sync");
        }
    }

    static void rejectConflict(String localType) {
        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "HubSpot and Nolyvra both changed this " + localType
                        + " since the last sync. Choose which side should overwrite the other.");
    }
}
