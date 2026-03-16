package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;

public record TalentSearchRequest(
    @NotBlank String query,     // natural language query
    String sortBy,              // MATCH_SCORE | RECENT (default MATCH_SCORE)
    Integer page,               // 0-based (default 0)
    Integer pageSize            // default 9
) {}
