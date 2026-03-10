package com.depthhire.app.model;

import java.time.Instant;
import java.util.List;

public record JobResponse(
    String id,
    String title,
    String company,
    String jobType,
    String seniority,
    String jdText,
    String location,
    List<String> stackTags,
    Instant createdAt
) {}
