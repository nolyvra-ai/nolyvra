package com.nolyvra.app.model;

import java.util.List;

public record SupportChatRequest(
        String message,
        List<ArticleContext> articles,
        List<ChatMessage> history
) {
    public record ArticleContext(String title, String summary, String body) {}

    public record ChatMessage(String role, String content) {}
}
