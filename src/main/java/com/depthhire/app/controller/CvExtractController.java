package com.depthhire.app.controller;

import com.depthhire.app.service.CvExtractService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/cv")
public class CvExtractController {

    private final CvExtractService cvExtractService;

    public CvExtractController(CvExtractService cvExtractService) {
        this.cvExtractService = cvExtractService;
    }

    @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> extractText(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        try {
            // Returns { text, name, email, phone, linkedinUrl }
            Map<String, Object> result = cvExtractService.extractWithFields(file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            // User-facing validation errors — 400
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            // Unexpected extraction failures — 500
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to extract text: " + e.getMessage()));
        }
    }
}