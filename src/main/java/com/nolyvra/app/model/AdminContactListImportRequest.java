package com.nolyvra.app.model;

import java.util.List;

public record AdminContactListImportRequest(
        String fileName,
        Integer headerRow,
        List<AdminContactListContact> contacts) {
}
