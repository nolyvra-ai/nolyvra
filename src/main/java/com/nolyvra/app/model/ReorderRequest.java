package com.nolyvra.app.model;

import java.util.List;

public record ReorderRequest(List<ReorderItem> items) {
    public record ReorderItem(String id, int sequence) {}
}
