package com.nolyvra.app.service;

import com.nolyvra.app.model.CvTemplateResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

// ─── CV Templates: recruiter-uploaded .docx merge-field templates, reused
// across candidates by the Format CV feature (see CvFormatService) ───────────

@Service
public class CvTemplateService {

    private final JdbcTemplate jdbc;

    public CvTemplateService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public CvTemplateResponse upload(String name, MultipartFile file, String loginId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a .docx template file.");
        }
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read template file: " + e.getMessage());
        }
        String id = "cvtpl-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO cv_templates (id, login_id, name, file_name, docx_data)
                VALUES (?, ?, ?, ?, ?)
                """,
                id, loginId, name, file.getOriginalFilename(), data);
        return getMeta(id, loginId);
    }

    public List<CvTemplateResponse> list(String loginId) {
        return jdbc.query("""
                SELECT id, name, file_name, created_at, updated_at
                FROM cv_templates
                WHERE login_id = ?
                ORDER BY created_at DESC
                """,
                (rs, rowNum) -> new CvTemplateResponse(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("file_name"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("updated_at", OffsetDateTime.class).toInstant()),
                loginId);
    }

    public byte[] getDocxData(String templateId, String loginId) {
        List<byte[]> rows = jdbc.query(
                "SELECT docx_data FROM cv_templates WHERE id = ? AND login_id = ?",
                (rs, rowNum) -> rs.getBytes("docx_data"),
                templateId, loginId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "CV template not found: " + templateId);
        }
        return rows.get(0);
    }

    public void delete(String templateId, String loginId) {
        int updated = jdbc.update("DELETE FROM cv_templates WHERE id = ? AND login_id = ?", templateId, loginId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "CV template not found: " + templateId);
        }
    }

    private CvTemplateResponse getMeta(String id, String loginId) {
        return jdbc.query("""
                SELECT id, name, file_name, created_at, updated_at
                FROM cv_templates
                WHERE id = ? AND login_id = ?
                """,
                (rs, rowNum) -> new CvTemplateResponse(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("file_name"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("updated_at", OffsetDateTime.class).toInstant()),
                id, loginId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV template not found: " + id));
    }
}
