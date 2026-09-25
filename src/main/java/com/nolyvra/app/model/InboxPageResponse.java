package com.nolyvra.app.model;

import java.util.List;

public record InboxPageResponse(
    List<InboxMessageSummary> messages,
    String nextPageToken
) {}
