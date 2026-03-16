// ── ClientBriefRequest.java ──────────────────────────────────────────────────
package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;

public record ClientBriefRequest(
    @NotBlank String briefText
) {}
