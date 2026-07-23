package com.nolyvra.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// One-off, admin-triggered data migration for the Candidate <-> Job
// Application split (see additional/sql/V56__job_applications.sql). Before
// this phase, one `candidates` row conflated a person with their application
// to one job, so the same person applying to two jobs became two
// disconnected rows. This groups those rows back into one person per tenant,
// using the same identity-matching chain CandidateImportService already
// uses for CSV import merges (email -> phone -> company+state+title), then
// creates a job_applications row per original (candidate, job) pair.
//
// Triggered via POST /api/auth/admin/migrate-applications — never run
// automatically; idempotent per tenant (skips if that tenant already has any
// job_applications rows).
@Service
public class CandidateMergeMigrationService {

    private final JdbcTemplate jdbc;

    public CandidateMergeMigrationService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final List<String> CANDIDATE_FK_TABLES = List.of(
            "activity_timeline", "analyses", "email_history", "interviews", "reminders",
            "interview_transcripts", "analysis_jobs", "employees", "contacts");

    private record CandidateRow(
            String id, String name, String email, String phone, String currentCompany,
            String state, String currentTitle, String jobId, String stage,
            String interviewQuestions, OffsetDateTime createdAt) {}

    public Map<String, Object> migrateTenant(String targetLoginId) {
        Integer existingApps = jdbc.queryForObject(
                "select count(*) from job_applications where login_id = ?", Integer.class, targetLoginId);
        if (existingApps != null && existingApps > 0) {
            return Map.of(
                    "status", "skipped",
                    "reason", "job_applications already exist for this tenant — migration already ran",
                    "loginId", targetLoginId);
        }

        List<CandidateRow> rows = jdbc.query("""
                select id, name, email, phone_number, current_company, state, current_title,
                       job_id, stage, interview_questions, created_at
                from candidates
                where login_id = ? and is_active = true
                order by created_at asc
                """,
                (rs, i) -> new CandidateRow(
                        rs.getString("id"), rs.getString("name"), rs.getString("email"),
                        rs.getString("phone_number"), rs.getString("current_company"),
                        rs.getString("state"), rs.getString("current_title"),
                        rs.getString("job_id"), rs.getString("stage"), rs.getString("interview_questions"),
                        rs.getObject("created_at", OffsetDateTime.class)),
                targetLoginId);

        List<CandidateRow> canonicalRows = new ArrayList<>();
        Map<String, List<CandidateRow>> groupMembers = new LinkedHashMap<>();
        long rowsWithoutStrongIdentifiers = 0;

        for (CandidateRow row : rows) {
            if (row.email() == null && row.phone() == null
                    && !(row.currentCompany() != null && row.state() != null && row.currentTitle() != null)) {
                rowsWithoutStrongIdentifiers++;
            }
            String canonicalId = findMatchingCanonical(row, canonicalRows);
            if (canonicalId == null) {
                canonicalRows.add(row);
                groupMembers.put(row.id(), new ArrayList<>());
            } else {
                groupMembers.get(canonicalId).add(row);
            }
        }

        int applicationsCreated = 0;
        int groupsMerged = 0;
        int rowsMerged = 0;

        for (CandidateRow canonical : canonicalRows) {
            List<CandidateRow> members = groupMembers.get(canonical.id());
            List<CandidateRow> group = new ArrayList<>();
            group.add(canonical);
            group.addAll(members);

            for (CandidateRow r : group) {
                if (r.jobId() == null) continue;
                jdbc.update("""
                        insert into job_applications
                            (id, login_id, candidate_id, job_id, stage, interview_questions, created_at, updated_at)
                        values (?, ?, ?, ?, ?, ?, ?, now())
                        on conflict (candidate_id, job_id) do nothing
                        """,
                        "app-" + UUID.randomUUID(), targetLoginId, canonical.id(), r.jobId(),
                        r.stage() != null ? r.stage() : "Screening", r.interviewQuestions(),
                        r.createdAt() != null ? r.createdAt() : OffsetDateTime.now());
                applicationsCreated++;
            }

            if (!members.isEmpty()) {
                groupsMerged++;
                for (CandidateRow member : members) {
                    mergeProfileFieldsOntoCanonical(member.id(), canonical.id());
                    repointForeignKeys(member.id(), canonical.id());
                    jdbc.update("""
                            update candidates set is_active = false, updated_at = now()
                            where id = ?
                            """, member.id());
                    rowsMerged++;
                }

                group.stream()
                        .filter(r -> r.jobId() != null)
                        .max(Comparator.comparing(r -> r.createdAt() != null ? r.createdAt() : OffsetDateTime.MIN))
                        .ifPresent(mostRecent -> jdbc.update("""
                                update candidates
                                set job_id = ?, stage = ?, interview_questions = ?, updated_at = now()
                                where id = ?
                                """, mostRecent.jobId(), mostRecent.stage(), mostRecent.interviewQuestions(),
                                canonical.id()));
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("status", "completed");
        summary.put("loginId", targetLoginId);
        summary.put("totalCandidateRows", rows.size());
        summary.put("distinctPeople", canonicalRows.size());
        summary.put("groupsMerged", groupsMerged);
        summary.put("rowsMerged", rowsMerged);
        summary.put("applicationsCreated", applicationsCreated);
        summary.put("rowsWithoutStrongIdentifiers", rowsWithoutStrongIdentifiers);
        return summary;
    }

    // Same tiered identity chain as CandidateImportService.findExistingCandidateId
    // (email -> phone -> company+state+title), applied against the in-memory
    // canonical list rather than a live query, since here every row is already
    // persisted and would trivially "match itself" via a DB lookup.
    private String findMatchingCanonical(CandidateRow row, List<CandidateRow> canonicalRows) {
        if (row.email() != null) {
            for (CandidateRow c : canonicalRows) {
                if (sameName(row, c) && equalsIgnoreCaseSafe(row.email(), c.email())) return c.id();
            }
            return null;
        }
        if (row.phone() != null) {
            for (CandidateRow c : canonicalRows) {
                if (sameName(row, c) && row.phone().equals(c.phone())) return c.id();
            }
            return null;
        }
        if (row.currentCompany() != null && row.state() != null && row.currentTitle() != null) {
            for (CandidateRow c : canonicalRows) {
                if (sameName(row, c)
                        && equalsIgnoreCaseSafe(row.currentCompany(), c.currentCompany())
                        && equalsIgnoreCaseSafe(row.state(), c.state())
                        && equalsIgnoreCaseSafe(row.currentTitle(), c.currentTitle()))
                    return c.id();
            }
            return null;
        }
        return null;
    }

    private boolean sameName(CandidateRow a, CandidateRow b) {
        return a.name() != null && b.name() != null
                && a.name().trim().equalsIgnoreCase(b.name().trim());
    }

    private boolean equalsIgnoreCaseSafe(String a, String b) {
        return a != null && b != null && a.equalsIgnoreCase(b);
    }

    private void mergeProfileFieldsOntoCanonical(String fromCandidateId, String toCandidateId) {
        jdbc.update("""
                update candidates c
                set email                = coalesce(c.email, o.email),
                    phone_number         = coalesce(c.phone_number, o.phone_number),
                    linkedin_url         = coalesce(c.linkedin_url, o.linkedin_url),
                    cv_text              = coalesce(c.cv_text, o.cv_text),
                    current_title        = coalesce(c.current_title, o.current_title),
                    current_company      = coalesce(c.current_company, o.current_company),
                    location             = coalesce(c.location, o.location),
                    state                = coalesce(c.state, o.state),
                    years_experience     = coalesce(c.years_experience, o.years_experience),
                    seniority_level      = coalesce(c.seniority_level, o.seniority_level),
                    expected_salary_min  = coalesce(c.expected_salary_min, o.expected_salary_min),
                    expected_salary_max  = coalesce(c.expected_salary_max, o.expected_salary_max),
                    salary_currency      = coalesce(c.salary_currency, o.salary_currency),
                    notice_period_weeks  = coalesce(c.notice_period_weeks, o.notice_period_weeks),
                    work_rights          = coalesce(c.work_rights, o.work_rights),
                    remote_flexible      = coalesce(c.remote_flexible, o.remote_flexible),
                    recruiter_notes      = coalesce(c.recruiter_notes, o.recruiter_notes),
                    updated_at           = now()
                from candidates o
                where c.id = ? and o.id = ?
                """, toCandidateId, fromCandidateId);
    }

    private void repointForeignKeys(String fromCandidateId, String toCandidateId) {
        for (String table : CANDIDATE_FK_TABLES) {
            jdbc.update("update " + table + " set candidate_id = ? where candidate_id = ?",
                    toCandidateId, fromCandidateId);
        }
    }
}
