package com.nolyvra.app.service;

import com.nolyvra.app.model.JobResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class HubSpotDealMapper {

    private final String pipeline;
    private final String dealStage;

    public HubSpotDealMapper(
            @Value("${hubspot.deal-pipeline:default}") String pipeline,
            @Value("${hubspot.deal-stage:appointmentscheduled}") String dealStage) {
        this.pipeline = pipeline;
        this.dealStage = dealStage;
    }

    public Map<String, String> fromJob(JobResponse job) {
        Map<String, String> properties = new LinkedHashMap<>();
        putIfPresent(properties, "dealname", job.title());
        putIfPresent(properties, "pipeline", pipeline);
        putIfPresent(properties, "dealstage", dealStage);
        putIfPresent(properties, "amount", job.estimatedFee());
        return properties;
    }

    private void putIfPresent(Map<String, String> properties, String key, String value) {
        if (value != null && !value.isBlank()) {
            properties.put(key, value.trim());
        }
    }

    private void putIfPresent(Map<String, String> properties, String key, BigDecimal value) {
        if (value != null) {
            properties.put(key, value.stripTrailingZeros().toPlainString());
        }
    }
}
