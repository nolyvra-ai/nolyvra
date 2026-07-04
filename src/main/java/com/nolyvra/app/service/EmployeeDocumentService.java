package com.nolyvra.app.service;

import com.nolyvra.app.model.EmployeeDocumentResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class EmployeeDocumentService {

    private static final long   MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
    private static final List<String> ALLOWED_TYPES = List.of(
            "application/pdf",
            "image/jpeg", "image/png", "image/webp",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final JdbcTemplate jdbc;

    public EmployeeDocumentService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private final RowMapper<EmployeeDocumentResponse> DOC_MAPPER = (rs, n) -> {
        OffsetDateTime uploaded = rs.getObject("uploaded_at", OffsetDateTime.class);
        Date expiry = rs.getDate("expiry_date");
        return new EmployeeDocumentResponse(
                rs.getString("id"),
                rs.getString("employee_id"),
                rs.getString("doc_type"),
                rs.getString("file_name"),
                expiry != null ? expiry.toLocalDate() : null,
                uploaded != null ? uploaded.toInstant() : null
        );
    };

    public List<EmployeeDocumentResponse> list(String employeeId, String loginId) {
        requireEmployeeOwned(employeeId, loginId);
        return jdbc.query("""
                SELECT id, employee_id, doc_type, file_name, expiry_date, uploaded_at
                FROM employee_document
                WHERE employee_id = ? AND login_id = ? AND is_active = true
                ORDER BY uploaded_at DESC
                """, DOC_MAPPER, employeeId, loginId);
    }

    public EmployeeDocumentResponse upload(String employeeId, MultipartFile file,
                                           String docType, String overrideName,
                                           LocalDate expiryDate, String loginId) {
        requireEmployeeOwned(employeeId, loginId);
        validateFile(file);
        validateDocType(docType);

        String fileName = Optional.ofNullable(overrideName)
                .filter(s -> !s.isBlank())
                .orElse(file.getOriginalFilename());
        String fileRef  = "edoc-" + UUID.randomUUID();
        String fileData;
        try {
            fileData = Base64.getEncoder().encodeToString(file.getBytes());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not read file: " + e.getMessage());
        }

        String id = "edoc-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO employee_document
                    (id, login_id, employee_id, doc_type, file_ref, file_name, expiry_date, file_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, id, loginId, employeeId, docType, fileRef, fileName, expiryDate, fileData);

        return list(employeeId, loginId).stream()
                .filter(d -> d.id().equals(id))
                .findFirst()
                .orElseThrow();
    }

    /** Returns [fileName, base64Data] for download endpoint. */
    public String[] download(String docId, String loginId) {
        List<String[]> rows = jdbc.query("""
                SELECT file_name, file_data
                FROM employee_document
                WHERE id = ? AND login_id = ? AND is_active = true
                """,
                (rs, n) -> new String[]{ rs.getString("file_name"), rs.getString("file_data") },
                docId, loginId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found: " + docId);
        }
        return rows.get(0);
    }

    public void delete(String employeeId, String docId, String loginId) {
        requireEmployeeOwned(employeeId, loginId);
        int rows = jdbc.update("""
                UPDATE employee_document SET is_active = false
                WHERE id = ? AND employee_id = ? AND login_id = ?
                """, docId, employeeId, loginId);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found: " + docId);
        }
    }

    private void requireEmployeeOwned(String employeeId, String loginId) {
        Integer cnt = jdbc.queryForObject(
                "SELECT COUNT(*) FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                Integer.class, employeeId, loginId);
        if (cnt == null || cnt == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found: " + employeeId);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "File exceeds 10 MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX");
        }
    }

    private void validateDocType(String docType) {
        if (docType != null && !docType.isBlank()) {
            List<String> valid = List.of("CONTRACT","ID","RIGHT_TO_WORK","CERTIFICATION","OTHER");
            if (!valid.contains(docType.toUpperCase())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid docType: " + docType);
            }
        }
    }
}
