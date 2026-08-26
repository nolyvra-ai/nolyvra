package com.nolyvra.app.model;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminContactListWorkspace(
        String fileName,
        Integer headerRow,
        OffsetDateTime importedAt,
        OffsetDateTime updatedAt,
        List<AdminContactListContact> contacts) {
}
