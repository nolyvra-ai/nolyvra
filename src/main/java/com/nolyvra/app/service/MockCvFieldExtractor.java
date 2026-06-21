package com.nolyvra.app.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@ConditionalOnExpression("'${nolyvra.mock-ai:false}' == 'true' || '${openai.api-key:}'.startsWith('sk-local-placeholder')")
public class MockCvFieldExtractor implements CvFieldExtractor {

    @Override
    public Map<String, Object> extractFields(String rawText, String originalFilename, String loginId) {
        return Map.of(
                "name", mockName(rawText, originalFilename),
                "email", firstMatch(rawText, "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}"),
                "phone", firstMatch(rawText, "(?:\\+?\\d[\\d .()\\-]{7,}\\d)"),
                "linkedinUrl", firstMatch(rawText, "https?://(?:www\\.)?linkedin\\.com/[^\\s)]+"),
                "skills", List.<String>of());
    }

    private static String mockName(String text, String fallbackName) {
        String[] lines = text.split("\\R");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.length() >= 3 && trimmed.length() <= 80 &&
                    !trimmed.contains("@") &&
                    !trimmed.toLowerCase().contains("resume") &&
                    !trimmed.toLowerCase().contains("curriculum vitae")) {
                return trimmed;
            }
        }
        if (fallbackName == null || fallbackName.isBlank()) return "Mock Candidate";
        return fallbackName.replaceFirst("\\.[^.]+$", "").replace('-', ' ').replace('_', ' ');
    }

    private static String firstMatch(String text, String regex) {
        Matcher matcher = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text);
        return matcher.find() ? matcher.group() : "";
    }
}
