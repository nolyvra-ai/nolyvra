package com.depthhire.app.model;

import java.util.List;

public record TalentSearchResponse(
    String query,
    int totalFound,
    int internalCount,
    int coreSignalCount,
    List<TalentSearchResult> results
) {}
