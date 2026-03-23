package com.nolyvra.app.controller;

import com.nolyvra.app.model.WorkflowResponse;
import com.nolyvra.app.service.WorkflowService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/candidates")
public class WorkflowController {

    private final WorkflowService workflowService;

    public WorkflowController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    @GetMapping("/{candidateId}/workflow")
    public WorkflowResponse getWorkflow(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return workflowService.getWorkflow(candidateId, loginId);
    }

    @PostMapping("/{candidateId}/notes")
    public Map<String, String> addNote(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {
        workflowService.addNote(candidateId, loginId, body.getOrDefault("note", ""));
        return Map.of("status", "saved");
    }
}
