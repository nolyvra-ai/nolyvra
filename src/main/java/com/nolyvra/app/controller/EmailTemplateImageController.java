package com.nolyvra.app.controller;

import com.nolyvra.app.service.EmailTemplateImageService;
import com.nolyvra.app.service.UserService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class EmailTemplateImageController {

    private final EmailTemplateImageService imageService;
    private final UserService userService;

    public EmailTemplateImageController(EmailTemplateImageService imageService, UserService userService) {
        this.imageService = imageService;
        this.userService = userService;
    }

    @PostMapping(
            value = "/auth/admin/email-template-images",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(
            @RequestParam String loginId,
            @RequestParam MultipartFile file) {
        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        EmailTemplateImageService.StoredImage image = imageService.upload(file, loginId);
        return ResponseEntity.ok(Map.of(
                "id", image.id(),
                "fileName", image.fileName()));
    }

    @GetMapping("/auth/admin/email-template-images/{id}")
    public ResponseEntity<?> preview(
            @PathVariable String id,
            @RequestParam String loginId) {
        if (!userService.isAdmin(loginId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        EmailTemplateImageService.StoredImage image = imageService.get(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.fileName() + "\"")
                .body(image.data());
    }
}
