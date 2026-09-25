package com.nolyvra.app.model;

public record EnrichmentStartRequest(
    String candidateId,      // present for DB-backed candidates (Jobs page table / INTERNAL talent-search results)
    String firstName,
    String lastName,
    String currentCompany    // optional — LinkedIn-derived company name, when already known (CoreSignal/Seltz/Parallel/Exa results)
) {}
