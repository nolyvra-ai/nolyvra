package com.nolyvra.app.controller;

import com.nolyvra.app.model.*;
import com.nolyvra.app.service.CoWorkerService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coworker")
public class CoWorkerController {

    private final CoWorkerService coWorkerService;

    public CoWorkerController(CoWorkerService coWorkerService) {
        this.coWorkerService = coWorkerService;
    }

    // POST /api/coworker/chat?loginId=x
    // Main chat — AI interprets message and returns reply + optional pending action
    @PostMapping("/chat")
    public CoWorkerChatResponse chat(
            @RequestParam String loginId,
            @RequestBody CoWorkerChatRequest request) {
        return coWorkerService.chat(loginId, request);
    }

    // POST /api/coworker/confirm?loginId=x
    // User confirms a pending action — executes it and returns result
    @PostMapping("/confirm")
    public Map<String, Object> confirm(
            @RequestParam String loginId,
            @RequestBody CoWorkerConfirmRequest request) {
        return coWorkerService.confirmAction(loginId, request);
    }

    // GET /api/coworker/tasks?loginId=x&status=active|done|all
    @GetMapping("/tasks")
    public List<CoWorkerTaskResponse> getTasks(
            @RequestParam String loginId,
            @RequestParam(defaultValue = "all") String status) {
        return coWorkerService.getTasks(loginId, status);
    }

    // GET /api/coworker/history?loginId=x
    @GetMapping("/history")
    public List<Map<String, String>> getHistory(@RequestParam String loginId) {
        return coWorkerService.getHistory(loginId);
    }
}
