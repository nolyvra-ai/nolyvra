package com.depthhire.app.model;

import java.util.Map;

public record CoWorkerChatResponse(
        String message,              // AI reply text shown in chat bubble
        PendingAction pendingAction  // non-null if AI wants user to confirm an action
) {
    // Represents an action the AI wants to take — requires user confirmation
    public record PendingAction(
            String type,             // RUN_ANALYSIS | SCHEDULE_INTERVIEW | MOVE_PIPELINE | EMAIL | CREATE_REMINDER
            String description,      // human-readable "I will do X"
            Map<String, Object> params // action-specific parameters
    ) {}
}
