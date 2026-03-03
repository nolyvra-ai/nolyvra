package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisRequest {

    @NotBlank
    private String cvText;

    @NotBlank
    private String jobDescription;

    @NotBlank
    private String linkedinProfile;
}
