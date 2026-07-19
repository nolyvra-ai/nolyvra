package com.nolyvra.app.service;

import com.nolyvra.app.model.JobResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HubSpotDealMapperTest {

    private final HubSpotDealMapper mapper = new HubSpotDealMapper(
            "default", "appointmentscheduled");

    @Test
    void mapsCompatibleDealProperties() {
        JobResponse job = new JobResponse(
                "job-1", " Senior Engineer ", "Nolyvra", "Full-time",
                null, "Build things", "Melbourne", List.of(), Instant.now(),
                "Active", new BigDecimal("180000.00"), "AUD",
                new BigDecimal("20.00"), null, null, new BigDecimal("36000.00"));

        Map<String, String> properties = mapper.fromJob(job);

        assertThat(properties).containsEntry("dealname", "Senior Engineer")
                .containsEntry("pipeline", "default")
                .containsEntry("dealstage", "appointmentscheduled")
                .containsEntry("amount", "36000");
    }

    @Test
    void omitsAmountWhenEstimatedFeeIsMissing() {
        JobResponse job = new JobResponse(
                "job-1", "Senior Engineer", "Nolyvra", "Full-time",
                null, null, null, List.of(), Instant.now(),
                "Active", null, "AUD", null, null, null, null);

        assertThat(mapper.fromJob(job)).containsEntry("dealname", "Senior Engineer")
                .doesNotContainKey("amount");
    }
}
