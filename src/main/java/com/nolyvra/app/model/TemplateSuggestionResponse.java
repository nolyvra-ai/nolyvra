package com.nolyvra.app.model;

import java.util.List;

public record TemplateSuggestionResponse(
    List<TemplateSuggestion> suggestions
) {}
