package com.nolyvra.app.model;

import java.util.List;

public record CoWorkerChatRequest(
        Long sessionId,              // null = create new session
        String message,
        List<ChatMessage> history
) {
    public record ChatMessage(String role, String content) {}
}
