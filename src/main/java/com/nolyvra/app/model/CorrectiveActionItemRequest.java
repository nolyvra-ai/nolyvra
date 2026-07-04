package com.nolyvra.app.model;

public record CorrectiveActionItemRequest(
        String itemText,
        Boolean isDone,
        Integer sortOrder
) {}
