package com.nolyvra.app.controller;

import com.nolyvra.app.model.CvTemplateResponse;
import com.nolyvra.app.service.CvTemplateService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/cv-templates")
public class CvTemplateController {

    private final CvTemplateService cvTemplateService;

    public CvTemplateController(CvTemplateService cvTemplateService) {
        this.cvTemplateService = cvTemplateService;
    }

    @PostMapping
    public CvTemplateResponse upload(
            @RequestParam String loginId,
            @RequestParam String name,
            @RequestParam("file") MultipartFile file) {
        return cvTemplateService.upload(name, file, loginId);
    }

    @GetMapping
    public List<CvTemplateResponse> list(@RequestParam String loginId) {
        return cvTemplateService.list(loginId);
    }

    @DeleteMapping("/{templateId}")
    public void delete(@PathVariable String templateId, @RequestParam String loginId) {
        cvTemplateService.delete(templateId, loginId);
    }
}
