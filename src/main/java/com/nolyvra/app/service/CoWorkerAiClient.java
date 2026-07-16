package com.nolyvra.app.service;

import com.nolyvra.app.model.CoWorkerChatRequest;
import com.nolyvra.app.model.CoWorkerChatResponse;

import java.util.List;

public interface CoWorkerAiClient {
    CoWorkerChatResponse chat(
            String loginId,
            Long sessionId,
            String message,
            String context,
            List<CoWorkerChatRequest.ChatMessage> history);
}
