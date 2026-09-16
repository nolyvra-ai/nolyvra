package com.nolyvra.app.model;

import java.util.Map;

public record SupportChatResponse(
        String answer,
        boolean escalated,
        String navigateTo,                 // set only when the assistant chose to navigate the user
        CoworkerIntent coworkerIntent       // set only when the assistant is handing off to CoWorker
) {
    public record CoworkerIntent(String intent, Map<String, Object> params) {}
}
