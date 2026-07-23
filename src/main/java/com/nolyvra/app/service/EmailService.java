package com.nolyvra.app.service;

import com.nolyvra.app.model.EmailHistoryResponse;
import com.nolyvra.app.model.EmailSendRequest;
import com.nolyvra.app.model.EmailTemplateResponse;
import org.springframework.context.annotation.Lazy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final JdbcTemplate jdbc;
    private final WorkflowService workflowService;
    private final MicrosoftOAuthService microsoftOAuthService;
    private final GoogleOAuthService googleOAuthService;
    private final String mailFrom;

    public EmailService(
            JavaMailSender mailSender,
            JdbcTemplate jdbc,
            WorkflowService workflowService,
            @Lazy MicrosoftOAuthService microsoftOAuthService,
            @Lazy GoogleOAuthService googleOAuthService,
            @Value("${spring.mail.username:}") String mailFrom) {
        this.mailSender             = mailSender;
        this.jdbc                   = jdbc;
        this.workflowService        = workflowService;
        this.microsoftOAuthService  = microsoftOAuthService;
        this.googleOAuthService     = googleOAuthService;
        this.mailFrom               = mailFrom;
    }

    private static final RowMapper<EmailHistoryResponse> HISTORY_MAPPER = (rs, rowNum) -> {
        OffsetDateTime sentAt = rs.getObject("sent_at", OffsetDateTime.class);
        return new EmailHistoryResponse(
                rs.getLong("id"),
                rs.getString("candidate_id"),
                rs.getString("to_address"),
                rs.getString("subject"),
                rs.getString("body"),
                rs.getString("template_type"),
                rs.getString("status"),
                sentAt != null ? sentAt.toInstant() : null,
                (Long) rs.getObject("client_id"));
    };

    private static final RowMapper<EmailTemplateResponse> TEMPLATE_MAPPER = (rs, rowNum) -> {
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        return new EmailTemplateResponse(
                rs.getLong("id"),
                rs.getString("template_type"),
                rs.getString("name"),
                rs.getString("subject"),
                rs.getString("body"),
                rs.getBoolean("is_default"),
                createdAt != null ? createdAt.toInstant() : null);
    };

    // ─── POST /api/emails/send ────────────────────────────────────────────────

    public EmailHistoryResponse sendEmail(EmailSendRequest req, String loginId) {
        String status = "Sent";
        try {
            String gmailToken = null;
            String outlookToken = null;
            try { gmailToken = googleOAuthService.getValidAccessToken(loginId); }
            catch (Exception ignored) {}
            try { outlookToken = microsoftOAuthService.getValidAccessToken(loginId); }
            catch (Exception ignored) {}

            if (gmailToken != null) {
                googleOAuthService.sendEmailViaGmail(loginId, req.toAddress(), req.subject(), req.body());
            } else if (outlookToken != null) {
                microsoftOAuthService.sendEmailViaOutlook(loginId, req.toAddress(), req.subject(), req.body());
            } else {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(req.toAddress());
                message.setSubject(req.subject());
                message.setText(req.body());
                mailSender.send(message);
            }
        } catch (Exception e) {
            status = "Failed";
            System.err.println("Failed to send email: " + e.getMessage());
        }

        // Blank string (not null) means "no candidate" from the frontend's default
        // form state — must become a real null, or the FK to candidates rejects it.
        String candidateId = (req.candidateId() != null && !req.candidateId().isBlank())
                ? req.candidateId() : null;

        // Persist history regardless of send status
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        final String finalStatus = status;
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    insert into email_history
                        (candidate_id, login_id, to_address, subject, body, template_type, status, client_id)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """, new String[]{"id"});
            ps.setString(1, candidateId);
            ps.setString(2, loginId);
            ps.setString(3, req.toAddress());
            ps.setString(4, req.subject());
            ps.setString(5, req.body());
            ps.setString(6, req.templateType());
            ps.setString(7, finalStatus);
            if (req.clientId() != null) {
                ps.setLong(8, req.clientId());
            } else {
                ps.setNull(8, java.sql.Types.BIGINT);
            }
            return ps;
        }, keys);

        Long newId = keys.getKey() != null ? keys.getKey().longValue() : null;

        // Record in activity timeline if linked to a candidate
        if (candidateId != null) {
            workflowService.recordEvent(candidateId, loginId, "EMAIL_SENT",
                    "Email sent: " + req.subject(), null);
        }

        return new EmailHistoryResponse(
                newId,
                candidateId,
                req.toAddress(),
                req.subject(),
                req.body(),
                req.templateType(),
                finalStatus,
                java.time.Instant.now(),
                req.clientId());
    }

    public boolean sendSystemEmail(String toAddress, String subject, String body) {
        if (toAddress == null || toAddress.isBlank()) {
            return false;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(toAddress);
            if (mailFrom != null && !mailFrom.isBlank()) {
                message.setFrom(mailFrom);
            }
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            return true;
        } catch (Exception e) {
            System.err.println("Failed to send system email to " + toAddress + ": " + e.getMessage());
            return false;
        }
    }

    // ─── GET /api/emails/history ──────────────────────────────────────────────

    public List<EmailHistoryResponse> getEmailHistory(String loginId, String candidateId) {
        if (candidateId != null && !candidateId.isBlank()) {
            return jdbc.query("""
                    select id, candidate_id, to_address, subject, body, template_type, status, sent_at, client_id
                    from email_history
                    where login_id = ? and candidate_id = ?
                    order by sent_at desc
                    """, HISTORY_MAPPER, loginId, candidateId);
        }
        return jdbc.query("""
                select id, candidate_id, to_address, subject, body, template_type, status, sent_at, client_id
                from email_history
                where login_id = ?
                order by sent_at desc
                """, HISTORY_MAPPER, loginId);
    }

    // ─── GET /api/emails/templates ────────────────────────────────────────────

    public List<EmailTemplateResponse> getTemplates(String loginId) {
        // Return user-specific first, then system defaults
        List<EmailTemplateResponse> userTemplates = jdbc.query("""
                select id, template_type, name, subject, body, is_default, created_at
                from email_templates
                where login_id = ?
                order by template_type, is_default desc, created_at desc
                """, TEMPLATE_MAPPER, loginId);

        if (!userTemplates.isEmpty()) return userTemplates;

        // Seed default templates if none exist for this user
        seedDefaultTemplates(loginId);
        return jdbc.query("""
                select id, template_type, name, subject, body, is_default, created_at
                from email_templates
                where login_id = ?
                order by template_type, is_default desc
                """, TEMPLATE_MAPPER, loginId);
    }

    // ─── Seed default templates ───────────────────────────────────────────────

    private void seedDefaultTemplates(String loginId) {
        Object[][] defaults = {
            { "INTERVIEW_INVITE", "Interview Invitation",
              "Interview Invitation — {role}",
              "Dear {name},\n\nThank you for your interest in the {role} position at {company}.\n\nWe are pleased to invite you to an interview. Please let us know your availability and we will send a confirmed calendar invitation.\n\nBest regards,\n{recruiter}" },
            { "FOLLOW_UP", "Follow-up After Interview",
              "Following up — {role} at {company}",
              "Dear {name},\n\nThank you for taking the time to interview with us for the {role} role.\n\nWe are currently reviewing all candidates and will be in touch shortly with an update.\n\nBest regards,\n{recruiter}" },
            { "REJECTION", "Rejection Email",
              "Your application for {role} at {company}",
              "Dear {name},\n\nThank you for your interest in the {role} position at {company} and for the time you invested in the process.\n\nAfter careful consideration, we have decided to move forward with another candidate whose experience more closely matches our current needs.\n\nWe wish you all the best in your search.\n\nKind regards,\n{recruiter}" },
            { "OFFER", "Offer Letter Email",
              "Job Offer — {role} at {company}",
              "Dear {name},\n\nWe are delighted to offer you the position of {role} at {company}.\n\nPlease find the formal offer details attached. We would be grateful if you could confirm your acceptance at your earliest convenience.\n\nWe look forward to welcoming you to the team.\n\nBest regards,\n{recruiter}" },
        };

        for (Object[] d : defaults) {
            jdbc.update("""
                    insert into email_templates (login_id, template_type, name, subject, body, is_default)
                    values (?, ?, ?, ?, ?, true)
                    on conflict do nothing
                    """, loginId, d[0], d[1], d[2], d[3]);
        }
    }
}
