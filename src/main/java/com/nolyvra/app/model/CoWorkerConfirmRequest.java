package com.nolyvra.app.model;

import java.util.Map;

public record CoWorkerConfirmRequest(
        String actionType,
        Map<String, Object> params
) {}
