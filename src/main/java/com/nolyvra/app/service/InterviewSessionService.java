package com.nolyvra.app.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateAnalysisResponse;
import com.nolyvra.app.model.InterviewAnswerResponse;
import com.nolyvra.app.model.InterviewCompleteResponse;
import com.nolyvra.app.model.InterviewIntroResponse;
import com.nolyvra.app.model.InterviewQuestionAnswer;
import com.nolyvra.app.model.InterviewSessionResponse;
import com.nolyvra.app.model.JobApplicationResponse;
import com.openai.client.OpenAIClient;
import com.openai.core.MultipartField;
import com.openai.models.audio.transcriptions.TranscriptionCreateParams;
import com.openai.models.audio.transcriptions.TranscriptionCreateResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

// Owns the interview_session table — the async, audio-only, tokenised
// interview flow. Reuses (unchanged): JobApplicationService for tenant
// scoping, the analyses table for the frozen question snapshot, EmailService
// for sending + logging the invitation, and InterviewTranscriptService for
// the actual AI analysis once a transcript exists (see analyse()).
@Service
public class InterviewSessionService {

    private static final int TOKEN_BYTES = 32;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final OpenAIClient openAI;
    private final JobApplicationService jobApplicationService;
    private final EmailService emailService;
    private final InterviewTranscriptService interviewTranscriptService;
    private final String transcriptionModel;
    private final String frontendUrl;
    private final int tokenTtlHours;
    private final int sessionTimeoutMinutes;
    private final SecureRandom secureRandom = new SecureRandom();

    public InterviewSessionService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            OpenAIClient openAI,
            JobApplicationService jobApplicationService,
            EmailService emailService,
            InterviewTranscriptService interviewTranscriptService,
            @Value("${openai.transcription-model:whisper-1}") String transcriptionModel,
            @Value("${interview.frontend-url:http://localhost:5173}") String frontendUrl,
            @Value("${interview.token-ttl-hours:168}") int tokenTtlHours,
            @Value("${interview.session-timeout-minutes:15}") int sessionTimeoutMinutes) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.openAI = openAI;
        this.jobApplicationService = jobApplicationService;
        this.emailService = emailService;
        this.interviewTranscriptService = interviewTranscriptService;
        this.transcriptionModel = transcriptionModel;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.tokenTtlHours = tokenTtlHours;
        this.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }

    // ─── Recruiter: Start / Regenerate ────────────────────────────────────────
    // Deletes any existing session (and its invitation email log entry) for
    // this candidate+application, snapshots the current suggested questions,
    // creates a fresh session, and emails the new link. Only the latest link
    // is ever valid — this is the single place a session gets created.

    @Transactional
    public InterviewSessionResponse startOrRegenerate(String candidateId, String applicationId, String loginId) {
        JobApplicationResponse app = jobApplicationService.getById(applicationId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Application not found: " + applicationId));
        if (!app.candidateId().equals(candidateId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found: " + applicationId);
        }

        CandidateInfo candidate = loadCandidateInfo(candidateId);
        if (candidate.email() == null || candidate.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This candidate has no email address on file.");
        }

        List<InterviewQuestionAnswer> snapshot = loadSuggestedQuestions(candidateId, app.jobId());
        if (snapshot.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No suggested interview questions found. Run CV Analysis for this candidate first.");
        }

        deleteExistingSession(candidateId, applicationId, loginId);

        String rawToken = generateToken();
        String id = "ivs-" + UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusHours(tokenTtlHours);

        jdbc.update("""
                insert into interview_session
                    (id, login_id, candidate_id, job_application_id, token_hash, token_expires_at,
                     questions_snapshot, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?::jsonb, 'SENT', ?, ?)
                """, id, loginId, candidateId, applicationId, hash(rawToken), expiresAt,
                toJson(snapshot), now, now);

        Long emailHistoryId = sendInvitationEmail(candidate, app, loginId, rawToken);
        if (emailHistoryId != null) {
            jdbc.update("update interview_session set invitation_email_history_id = ? where id = ?",
                    emailHistoryId, id);
        }

        return getSessionResponse(id);
    }

    // ─── Recruiter: current status (drives the Jobs Applied card buttons) ────

    public Optional<InterviewSessionResponse> getStatus(String candidateId, String applicationId, String loginId) {
        return jdbc.query("""
                select * from interview_session
                where candidate_id = ? and job_application_id = ? and login_id = ?
                """, rs -> rs.next() ? Optional.of(mapRow(rs)) : Optional.<InterviewSessionResponse>empty(),
                candidateId, applicationId, loginId);
    }

    // ─── Recruiter: Analyse Interview ─────────────────────────────────────────
    // Feeds the assembled transcript into InterviewTranscriptService exactly
    // as an uploaded transcript is handled today — same method, same token
    // metering (it deducts internally), same candidate analysis storage.

    @Transactional
    public InterviewSessionResponse analyse(String candidateId, String applicationId, String loginId) {
        SessionRow row = loadByCandidateApplication(candidateId, applicationId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No interview session found for this application."));
        if (!"COMPLETED".equals(row.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The candidate hasn't completed the interview yet.");
        }

        interviewTranscriptService.analyseTranscript(candidateId, loginId, null, row.transcript());

        jdbc.update("update interview_session set status = 'ANALYSED', updated_at = now() where id = ?", row.id());
        return getSessionResponse(row.id());
    }

    // ─── Public: intro screen ──────────────────────────────────────────────────

    public InterviewIntroResponse getIntro(String rawToken) {
        SessionRow row = requireActive(rawToken);
        JobCandidateInfo info = loadJobCandidateInfo(row.jobApplicationId(), row.candidateId());
        return new InterviewIntroResponse(
                firstName(info.candidateName()),
                info.jobTitle(),
                info.companyName(),
                row.status(),
                sessionTimeoutMinutes,
                row.consentAt() != null ? row.consentAt().toInstant() : null,
                parseQuestions(row.questionsSnapshotJson()));
    }

    // ─── Public: submit one audio answer ──────────────────────────────────────
    // Transcribes in memory and never persists the audio itself — only the
    // resulting text is written to questions_snapshot.

    public InterviewAnswerResponse submitAnswer(String rawToken, int questionOrder,
                                                 byte[] audioBytes, String mimeType, Integer durationSecs) {
        SessionRow row = requireActive(rawToken);
        if (audioBytes == null || audioBytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No audio was recorded for this answer.");
        }

        List<InterviewQuestionAnswer> questions = parseQuestions(row.questionsSnapshotJson());
        if (questions.stream().noneMatch(q -> q.order() == questionOrder)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown question: " + questionOrder);
        }

        String transcriptText = transcribeAudio(audioBytes, mimeType);
        // Audio bytes are never written to disk/S3/DB — the local reference
        // above is the only copy, and it goes out of scope once this method returns.

        List<InterviewQuestionAnswer> updated = questions.stream()
                .map(q -> q.order() == questionOrder
                        ? new InterviewQuestionAnswer(q.order(), q.question(), transcriptText, durationSecs)
                        : q)
                .toList();

        boolean firstAnswer = "SENT".equals(row.status());
        String newStatus = firstAnswer ? "STARTED" : row.status();
        jdbc.update("""
                update interview_session
                set questions_snapshot = ?::jsonb,
                    status = ?,
                    consent_at = coalesce(consent_at, ?),
                    updated_at = now()
                where id = ?
                """, toJson(updated), newStatus, OffsetDateTime.now(), row.id());

        return new InterviewAnswerResponse(questionOrder, newStatus);
    }

    // ─── Public: complete ─────────────────────────────────────────────────────
    // Called either when the candidate submits the last answer, or when the
    // 15-minute timer hits zero (auto-submit) — assembles whatever has been
    // recorded so far into the transcript, answered or not.

    public InterviewCompleteResponse complete(String rawToken) {
        SessionRow row = requireActive(rawToken);
        List<InterviewQuestionAnswer> questions = parseQuestions(row.questionsSnapshotJson());
        String transcript = assembleTranscript(questions);

        jdbc.update("""
                update interview_session
                set transcript = ?, status = 'COMPLETED', completed_at = now(), updated_at = now()
                where id = ?
                """, transcript, row.id());

        return new InterviewCompleteResponse("COMPLETED",
                "Thanks for completing your interview! We appreciate the time you took to respond, "
                        + "and we'll be in touch soon with next steps.");
    }

    // ─── Private: session lookup / lifecycle ──────────────────────────────────

    private void deleteExistingSession(String candidateId, String applicationId, String loginId) {
        Long emailHistoryId = jdbc.query("""
                select invitation_email_history_id from interview_session
                where candidate_id = ? and job_application_id = ? and login_id = ?
                """, rs -> rs.next() ? (Long) rs.getObject("invitation_email_history_id") : null,
                candidateId, applicationId, loginId);

        jdbc.update("""
                delete from interview_session
                where candidate_id = ? and job_application_id = ? and login_id = ?
                """, candidateId, applicationId, loginId);

        if (emailHistoryId != null) {
            emailService.deleteEmailHistory(emailHistoryId, loginId);
        }
    }

    private record SessionRow(
            String id, String status, String transcript, String tokenHash,
            OffsetDateTime tokenExpiresAt, String questionsSnapshotJson,
            String candidateId, String jobApplicationId, String loginId,
            OffsetDateTime consentAt) {}

    private static final String SESSION_ROW_COLS =
            "id, status, transcript, token_hash, token_expires_at, questions_snapshot, " +
            "candidate_id, job_application_id, login_id, consent_at";

    private SessionRow sessionRowMapper(ResultSet rs) throws SQLException {
        return new SessionRow(
                rs.getString("id"), rs.getString("status"), rs.getString("transcript"),
                rs.getString("token_hash"), rs.getObject("token_expires_at", OffsetDateTime.class),
                rs.getString("questions_snapshot"), rs.getString("candidate_id"),
                rs.getString("job_application_id"), rs.getString("login_id"),
                rs.getObject("consent_at", OffsetDateTime.class));
    }

    private Optional<SessionRow> loadByCandidateApplication(String candidateId, String applicationId, String loginId) {
        return jdbc.query("select " + SESSION_ROW_COLS + """
                 from interview_session
                 where candidate_id = ? and job_application_id = ? and login_id = ?
                """, rs -> rs.next() ? Optional.of(sessionRowMapper(rs)) : Optional.<SessionRow>empty(),
                candidateId, applicationId, loginId);
    }

    private Optional<SessionRow> loadByTokenHash(String tokenHash) {
        return jdbc.query("select " + SESSION_ROW_COLS + " from interview_session where token_hash = ?",
                rs -> rs.next() ? Optional.of(sessionRowMapper(rs)) : Optional.<SessionRow>empty(),
                tokenHash);
    }

    // Shared guard for every public (token-gated) action: unknown token -> 404,
    // expired -> 410 (and flips status to EXPIRED), already finished -> 409.
    private SessionRow requireActive(String rawToken) {
        SessionRow row = loadByTokenHash(hash(rawToken))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid interview link."));

        if (row.tokenExpiresAt() != null && row.tokenExpiresAt().isBefore(OffsetDateTime.now())) {
            jdbc.update("""
                    update interview_session set status = 'EXPIRED', updated_at = now()
                    where id = ? and status not in ('COMPLETED','ANALYSED')
                    """, row.id());
            throw new ResponseStatusException(HttpStatus.GONE, "This interview link has expired.");
        }
        if ("EXPIRED".equals(row.status())) {
            throw new ResponseStatusException(HttpStatus.GONE, "This interview link has expired.");
        }
        if ("COMPLETED".equals(row.status()) || "ANALYSED".equals(row.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This interview has already been completed.");
        }
        return row;
    }

    private InterviewSessionResponse getSessionResponse(String id) {
        return jdbc.query("select * from interview_session where id = ?",
                rs -> { rs.next(); return mapRow(rs); }, id);
    }

    private InterviewSessionResponse mapRow(ResultSet rs) throws SQLException {
        return new InterviewSessionResponse(
                rs.getString("id"),
                rs.getString("candidate_id"),
                rs.getString("job_application_id"),
                rs.getString("status"),
                parseQuestions(rs.getString("questions_snapshot")),
                toInstant(rs, "token_expires_at"),
                toInstant(rs, "consent_at"),
                toInstant(rs, "created_at"),
                toInstant(rs, "completed_at"));
    }

    private Instant toInstant(ResultSet rs, String col) throws SQLException {
        OffsetDateTime odt = rs.getObject(col, OffsetDateTime.class);
        return odt != null ? odt.toInstant() : null;
    }

    // ─── Private: suggested-questions snapshot (reuses the analyses table that
    // already backs the CV-analysis "Suggested Questions" UI, unchanged) ──────

    private List<InterviewQuestionAnswer> loadSuggestedQuestions(String candidateId, String jobId) {
        String json = jdbc.query("""
                select analysis_json from analyses
                where candidate_id = ? and (job_id = ? or ? is null)
                order by analyzed_at desc nulls last
                limit 1
                """, rs -> rs.next() ? rs.getString("analysis_json") : null, candidateId, jobId, jobId);
        if (json == null) return List.of();
        try {
            CandidateAnalysisResponse parsed = objectMapper.readValue(json, CandidateAnalysisResponse.class);
            List<CandidateAnalysisResponse.SuggestedQuestion> suggested = parsed.suggestedQuestions();
            if (suggested == null) return List.of();
            return suggested.stream()
                    .map(q -> new InterviewQuestionAnswer(q.order(), q.question(), null, null))
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    // ─── Private: invitation email ────────────────────────────────────────────

    private record CandidateInfo(String name, String email) {}
    private record JobCandidateInfo(String candidateName, String jobTitle, String companyName) {}

    private CandidateInfo loadCandidateInfo(String candidateId) {
        return jdbc.query("select name, email from candidates where id = ?",
                rs -> rs.next() ? new CandidateInfo(rs.getString("name"), rs.getString("email"))
                        : new CandidateInfo(null, null),
                candidateId);
    }

    private JobCandidateInfo loadJobCandidateInfo(String applicationId, String candidateId) {
        return jdbc.query("""
                select c.name as candidate_name, j.title as job_title, l.company as company_name
                from job_applications ja
                join jobs j on j.id = ja.job_id
                join candidates c on c.id = ja.candidate_id
                join login l on l.id = ja.login_id
                where ja.id = ? and c.id = ?
                """, rs -> rs.next()
                        ? new JobCandidateInfo(rs.getString("candidate_name"), rs.getString("job_title"), rs.getString("company_name"))
                        : new JobCandidateInfo(null, null, null),
                applicationId, candidateId);
    }

    private String firstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "there";
        return fullName.trim().split("\\s+")[0];
    }

    private Long sendInvitationEmail(CandidateInfo candidate, JobApplicationResponse app, String loginId, String rawToken) {
        RecruiterInfo recruiter = loadRecruiterInfo(loginId);
        String candidateFirstName = firstName(candidate.name());
        String jobTitle = app.jobTitle() != null ? app.jobTitle() : "this role";
        boolean hasCompany = recruiter.company() != null && !recruiter.company().isBlank();
        String companySuffix = hasCompany ? " at " + recruiter.company() : "";
        String teamLine = hasCompany ? recruiter.company() + " Recruitment Team" : "Recruitment Team";
        String recruiterName = (recruiter.name() != null && !recruiter.name().isBlank()) ? recruiter.name() : teamLine;
        String interviewLink = frontendUrl + "/interview/" + rawToken;

        String subject = "Your audio interview for " + jobTitle + companySuffix;
        String textBody = """
                Hi %s,

                Thanks for your interest in the %s role%s. As the next step, we'd like to invite you to complete a short audio interview.

                How it works:
                • It takes about %d minutes.
                • You'll answer a few questions by recording short audio responses — no video, and nothing to schedule.
                • Start whenever you're ready. Just find a quiet spot with a working microphone.

                Start your interview:
                %s

                This link is unique to you. If you receive a newer invitation, only the most recent link will work.

                All the best — we're looking forward to hearing from you.

                Kind regards,
                %s
                %s
                """.formatted(candidateFirstName, jobTitle, companySuffix, sessionTimeoutMinutes, interviewLink,
                        recruiterName, teamLine);

        String htmlBody = """
                <p>Hi %s,</p>
                <p>Thanks for your interest in the %s role%s. As the next step, we'd like to invite you to complete a short audio interview.</p>
                <p><b>How it works:</b></p>
                <ul>
                  <li>It takes about %d minutes.</li>
                  <li>You'll answer a few questions by recording short audio responses — no video, and nothing to schedule.</li>
                  <li>Start whenever you're ready. Just find a quiet spot with a working microphone.</li>
                </ul>
                <p><a href="%s">Start your interview</a></p>
                <p>This link is unique to you. If you receive a newer invitation, only the most recent link will work.</p>
                <p>All the best — we're looking forward to hearing from you.</p>
                <p>Kind regards,<br>%s<br>%s</p>
                """.formatted(candidateFirstName, jobTitle, companySuffix, sessionTimeoutMinutes, interviewLink,
                        recruiterName, teamLine);

        return emailService.sendInterviewInviteEmail(
                candidate.email(), app.candidateId(), loginId, subject, textBody, htmlBody);
    }

    private record RecruiterInfo(String name, String company) {}

    private RecruiterInfo loadRecruiterInfo(String loginId) {
        return jdbc.query("select name, company from login where id = ?",
                rs -> rs.next() ? new RecruiterInfo(rs.getString("name"), rs.getString("company"))
                        : new RecruiterInfo(null, null),
                loginId);
    }

    // ─── Private: transcript assembly ─────────────────────────────────────────

    private String assembleTranscript(List<InterviewQuestionAnswer> questions) {
        StringBuilder sb = new StringBuilder();
        for (InterviewQuestionAnswer q : questions) {
            sb.append("Q").append(q.order()).append(": ").append(q.question()).append("\n");
            sb.append("A").append(q.order()).append(": ")
                    .append(q.answerText() != null && !q.answerText().isBlank() ? q.answerText() : "[No answer recorded]")
                    .append("\n\n");
        }
        return sb.toString().trim();
    }

    // ─── Private: OpenAI audio transcription (Step 2 — no new dependency; the
    // audio-transcription endpoint classes ship in the openai-java-core jar
    // already used everywhere else for chat completions) ──────────────────────

    private String transcribeAudio(byte[] audioBytes, String mimeType) {
        MultipartField<InputStream> filePart = MultipartField.<InputStream>builder()
                .value(new ByteArrayInputStream(audioBytes))
                .filename("answer" + extensionFor(mimeType))
                .contentType(mimeType != null && !mimeType.isBlank() ? mimeType : "audio/webm")
                .build();
        TranscriptionCreateParams params = TranscriptionCreateParams.builder()
                .file(filePart)
                .model(transcriptionModel)
                .build();
        TranscriptionCreateResponse response = openAI.audio().transcriptions().create(params);
        return response.asTranscription().text().trim();
    }

    private String extensionFor(String mimeType) {
        if (mimeType == null) return ".webm";
        String m = mimeType.toLowerCase(Locale.ROOT);
        if (m.contains("webm")) return ".webm";
        if (m.contains("ogg")) return ".ogg";
        if (m.contains("mp4") || m.contains("m4a")) return ".m4a";
        if (m.contains("mpeg") || m.contains("mp3")) return ".mp3";
        if (m.contains("wav")) return ".wav";
        return ".webm";
    }

    // ─── Private: JSON + token helpers ─────────────────────────────────────────

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialise interview data", e);
        }
    }

    private List<InterviewQuestionAnswer> parseQuestions(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
