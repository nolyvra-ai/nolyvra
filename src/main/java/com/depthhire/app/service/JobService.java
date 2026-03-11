package com.depthhire.app.service;

import com.depthhire.app.model.JobCreateRequest;
import com.depthhire.app.model.JobResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class JobService {

    private final JdbcTemplate jdbc;

    public JobService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<JobResponse> JOB_MAPPER = (rs, rowNum) -> {

        OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);

        return new JobResponse(
                rs.getString("id"),
                rs.getString("title"),
                rs.getString("company"),
                rs.getString("job_type"),
                null, // seniority not stored yet
                rs.getString("jd_text"),
                rs.getString("location"),
                List.of(), // stackTags not stored yet
                created != null ? created.toInstant() : null);
    };

    public JobResponse createJob(JobCreateRequest req, String loginId) {

        String id = "job-" + UUID.randomUUID();

        jdbc.update("""
                insert into jobs (id, title, company, job_type, jd_text, location)
                values (?, ?, ?, ?, ?, ?)
                """,
                id,
                req.title(),
                req.company(),
                req.jobType(),
                req.jdText(),
                req.location(),
                loginId);

        return new JobResponse(
                id,
                req.title(),
                req.company(),
                req.jobType(),
                req.seniority(),
                req.jdText(),
                req.location(),
                req.stackTags() != null ? req.stackTags() : List.of(),
                Instant.now());
    }

    public List<JobResponse> listJobs(String loginId) {
        return jdbc.query("""
                select id, title, company, job_type, jd_text, created_at, location
                from jobs
                where login_id = ?
                order by created_at desc
                """, JOB_MAPPER, loginId);
    }

    public Optional<JobResponse> getJob(String jobId, String loginId) {

        List<JobResponse> rows = jdbc.query("""
                select id, title, company, job_type, jd_text, created_at
                from jobs
                where id = ?
                and login_id = ?
                """, JOB_MAPPER, jobId, loginId);

        return rows.stream().findFirst();
    }
}