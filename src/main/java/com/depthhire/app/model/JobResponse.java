package com.depthhire.app.model;

import java.time.Instant;
import java.util.List;

public record JobResponse(
    String id,
    String title,
    String seniority,
    String jdText,
    List<String> stackTags,
    Instant createdAt
) {}
