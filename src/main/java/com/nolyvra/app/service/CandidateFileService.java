package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateFileResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

// Candidate detail page — Files tab: upload/download/delete arbitrary files
// per candidate. Mirrors ClientService's client_files block verbatim, keyed
// by candidate_id instead of client_id — see additional/sql/V57__candidate_files_and_experience.sql.
@Service
public class CandidateFileService {

    private final JdbcTemplate jdbc;

    public CandidateFileService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CandidateFileResponse> getCandidateFiles(String candidateId, String loginId) {
        return jdbc.query("""
                SELECT id, file_name, content_type, length(file_data) AS size_bytes, uploaded_at
                FROM candidate_files
                WHERE login_id = ? AND candidate_id = ?
                ORDER BY uploaded_at DESC
                """,
                (rs, i) -> {
                    var ts = rs.getTimestamp("uploaded_at");
                    return new CandidateFileResponse(
                            rs.getLong("id"), rs.getString("file_name"), rs.getString("content_type"),
                            rs.getLong("size_bytes"), ts != null ? ts.toInstant() : null);
                }, loginId, candidateId);
    }

    public CandidateFileResponse uploadCandidateFile(String candidateId, String loginId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A file is required");
        }
        byte[] data;
        try { data = file.getBytes(); }
        catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read file"); }

        Long id = jdbc.queryForObject("""
                INSERT INTO candidate_files (login_id, candidate_id, file_name, content_type, file_data)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class,
                loginId, candidateId, file.getOriginalFilename(), file.getContentType(), data);

        return new CandidateFileResponse(id, file.getOriginalFilename(), file.getContentType(),
                data.length, Instant.now());
    }

    public Map<String, Object> getCandidateFileRaw(String candidateId, Long fileId, String loginId) {
        var rows = jdbc.queryForList(
                "SELECT file_name, content_type, file_data FROM candidate_files WHERE id = ? AND candidate_id = ? AND login_id = ?",
                fileId, candidateId, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        return rows.get(0);
    }

    public void deleteCandidateFile(String candidateId, Long fileId, String loginId) {
        int deleted = jdbc.update(
                "DELETE FROM candidate_files WHERE id = ? AND candidate_id = ? AND login_id = ?",
                fileId, candidateId, loginId);
        if (deleted == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
    }
}
