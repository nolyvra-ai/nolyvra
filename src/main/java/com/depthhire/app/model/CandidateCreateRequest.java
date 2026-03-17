package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

@Builder
public record CandidateCreateRequest(

    @NotBlank
    String name,

    String email,

    String linkedinUrl,

    @NotBlank
    String cvText

) {}