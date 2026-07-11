package com.nolyvra.app.model;

import java.util.List;

public record PotentialClientResponse(
    String externalId,
    String companyName,
    String industry,
    String size,
    String location,
    String hiringSignal,
    List<String> signalReasons,
    int openRoles,
    int matchScore,
    int growthPct,
    List<DecisionMaker> decisionMakers,
    String description,
    String websiteUrl,
    String linkedinUrl,
    String foundedYear,
    String companyType,
    List<String> specialties,
    List<NewsArticle> newsArticles,
    int totalEmployees,
    double postingsGrowthPct,
    String hqCity,
    String hqCountry
) {
    public record DecisionMaker(String name, String title) {}
    public record NewsArticle(String headline, String date) {}
}
