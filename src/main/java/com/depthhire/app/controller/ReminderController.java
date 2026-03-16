package com.depthhire.app.controller;

import com.depthhire.app.model.ReminderCreateRequest;
import com.depthhire.app.model.ReminderResponse;
import com.depthhire.app.service.ReminderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {

    private final ReminderService reminderService;

    public ReminderController(ReminderService reminderService) {
        this.reminderService = reminderService;
    }

    // GET /api/reminders?loginId=x&filter=today|upcoming|overdue|all
    @GetMapping
    public List<ReminderResponse> getReminders(
            @RequestParam String loginId,
            @RequestParam(required = false) String filter) {
        return reminderService.getReminders(loginId, filter);
    }

    @PostMapping
    public ReminderResponse createReminder(
            @Valid @RequestBody ReminderCreateRequest req,
            @RequestParam String loginId) {
        return reminderService.createReminder(req, loginId);
    }

    @PatchMapping("/{reminderId}/complete")
    public Map<String, String> markComplete(
            @PathVariable Long reminderId,
            @RequestParam String loginId) {
        boolean done = reminderService.markComplete(reminderId, loginId);
        if (!done) throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Reminder not found: " + reminderId);
        return Map.of("status", "completed");
    }

    @DeleteMapping("/{reminderId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReminder(
            @PathVariable Long reminderId,
            @RequestParam String loginId) {
        boolean deleted = reminderService.deleteReminder(reminderId, loginId);
        if (!deleted) throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Reminder not found: " + reminderId);
    }
}
