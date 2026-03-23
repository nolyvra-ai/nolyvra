// ── ClientBriefRequest.java ──────────────────────────────────────────────────
package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record ClientBriefRequest(
    @NotBlank String briefText
) {}
