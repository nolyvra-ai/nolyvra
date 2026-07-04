package com.nolyvra.app.model;

public record CorrectiveActionItemResponse(
        String id,
        String itemText,
        boolean isDone,
        int sortOrder
) {}
