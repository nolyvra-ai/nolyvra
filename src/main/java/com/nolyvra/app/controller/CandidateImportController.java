package com.nolyvra.app.controller;

import com.nolyvra.app.model.CandidateImportConfirmRequest;
import com.nolyvra.app.model.CandidateImportPreviewResponse;
import com.nolyvra.app.model.CandidateImportResultResponse;
import com.nolyvra.app.service.CandidateImportService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/candidates/import")
public class CandidateImportController {

    private final CandidateImportService candidateImportService;

    public CandidateImportController(CandidateImportService candidateImportService) {
        this.candidateImportService = candidateImportService;
    }

    @PostMapping("/preview")
    public CandidateImportPreviewResponse preview(
            @RequestParam MultipartFile file,
            @RequestParam String loginId) {
        try {
            return candidateImportService.previewImport(file, loginId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not read file — please ensure it's a valid .xlsx, .xls or .csv file");
        }
    }

    @PostMapping("/confirm")
    public CandidateImportResultResponse confirm(
            @RequestParam String loginId,
            @RequestBody CandidateImportConfirmRequest req) {
        try {
            return candidateImportService.confirmImport(req.importToken(), req.mapping(), loginId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Import failed: " + e.getMessage());
        }
    }

    @PostMapping("/confirm-async")
    public Map<String, String> confirmAsync(
            @RequestParam String loginId,
            @RequestBody CandidateImportConfirmRequest req) {
        try {
            String jobId = candidateImportService.startImportAsync(req.importToken(), req.mapping(), loginId);
            return Map.of("jobId", jobId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not start import: " + e.getMessage());
        }
    }

    @GetMapping("/status/{jobId}")
    public Map<String, Object> getStatus(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        try {
            return candidateImportService.getImportStatus(jobId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not retrieve status: " + e.getMessage());
        }
    }
}
