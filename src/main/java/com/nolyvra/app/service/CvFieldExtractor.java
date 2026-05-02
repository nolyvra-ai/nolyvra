package com.nolyvra.app.service;

import java.util.Map;

public interface CvFieldExtractor {
    Map<String, Object> extractFields(String rawText, String originalFilename, String loginId);
}

