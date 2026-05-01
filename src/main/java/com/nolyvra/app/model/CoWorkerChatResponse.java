package com.nolyvra.app.model;

import java.util.Map;

public record CoWorkerChatResponse(
        Long sessionId,              // session this message belongs to — returned so frontend can track
        String message,
        PendingAction pendingAction
) {
    public record PendingAction(
            String type,
            String description,
            Map<String, Object> params
    ) {}
}
