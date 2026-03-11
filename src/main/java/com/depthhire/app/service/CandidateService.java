package com.depthhire.app.service;

import com.depthhire.app.model.CandidateCreateRequest;
import com.depthhire.app.model.CandidateResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.OffsetDateTime;

@Service
public class CandidateService {

    private final JdbcTemplate jdbc;

    public CandidateService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<CandidateResponse> CANDIDATE_MAPPER = (rs, rowNum) -> {
        OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);
        return new CandidateResponse(
                rs.getString("id"),
                rs.getString("job_id"),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("linkedin_url"),
                odt != null ? odt.toInstant() : null);
    };

    public CandidateResponse addCandidate(String jobId, CandidateCreateRequest req, String loginId) {

        String id = "cand-" + UUID.randomUUID();

        jdbc.update("""
                insert into candidates (id, job_id, job_id, name, email, linkedin_url, cv_text)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                id,
                jobId,
                loginId,
                req.name(),
                req.email(),
                req.linkedinUrl(),
                req.cvText());

        return new CandidateResponse(
                id,
                jobId,
                req.name(),
                req.email(),
                req.linkedinUrl(),
                Instant.now());
    }

    public Optional<CandidateResponse> getCandidate(String candidateId, String loginId) {
        List<CandidateResponse> rows = jdbc.query("""
                select id, job_id, name, email, linkedin_url, created_at
                from candidates
                where id = ?
                and login_id = ?
                """, CANDIDATE_MAPPER, candidateId, loginId);

        return rows.stream().findFirst();
    }

    public List<CandidateResponse> getCandidatesByJob(String jobId, String loginId ) {

        return jdbc.query("""
                select id, job_id, name, email, linkedin_url, created_at
                from candidates
                where job_id = ?
                and login_id = ?
                order by created_at desc
                """,
                CANDIDATE_MAPPER,
                jobId, loginId);
    }
}