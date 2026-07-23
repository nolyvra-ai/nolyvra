package com.nolyvra.app.model;

import java.util.List;

public record CandidateExperienceResponse(
        List<WorkExperienceEntry> workExperience,
        List<EducationEntry> education
) {
    public record WorkExperienceEntry(
            String company,
            String title,
            String startDate,
            String endDate,
            String description
    ) {}

    public record EducationEntry(
            String institution,
            String degree,
            String fieldOfStudy,
            String startDate,
            String endDate
    ) {}
}
