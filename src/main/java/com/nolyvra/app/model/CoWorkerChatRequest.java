package com.nolyvra.app.model;

import java.util.List;

public record CoWorkerChatRequest(
        String message,
        List<ChatMessage> history  // last N messages for context
) {
    public record ChatMessage(String role, String content) {}
}
