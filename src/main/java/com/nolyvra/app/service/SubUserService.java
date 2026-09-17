package com.nolyvra.app.service;

import com.nolyvra.app.model.PlanUsageResponse;
import com.nolyvra.app.model.SubUserCreateRequest;
import com.nolyvra.app.model.SubUserResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class SubUserService {

    private final JdbcTemplate jdbc;
    private final PlanService planService;
    private final EmailVerificationService emailVerificationService;

    public SubUserService(
            JdbcTemplate jdbc,
            PlanService planService,
            EmailVerificationService emailVerificationService) {
        this.jdbc = jdbc;
        this.planService = planService;
        this.emailVerificationService = emailVerificationService;
    }

    public List<SubUserResponse> list(String parentLoginId) {
        return jdbc.query("""
                select id, name, email, company, phone_number, email_verified_at, created_at
                from login
                where parent_login_id = ?
                order by created_at asc
                """,
                (rs, r) -> new SubUserResponse(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("email"),
                        rs.getString("company"),
                        rs.getString("phone_number"),
                        rs.getObject("email_verified_at") != null,
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()),
                parentLoginId);
    }

    public SubUserResponse invite(String parentLoginId, SubUserCreateRequest req) {
        PlanUsageResponse usage = planService.getPlanUsage(parentLoginId);
        if (usage.maxSubUsers() <= 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Your plan does not include additional team members.");
        }
        if (usage.currentSubUsers() >= usage.maxSubUsers()) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "You've reached your plan's limit of " + usage.maxSubUsers() + " team members.");
        }

        List<String> existing = jdbc.query(
                "select id from login where email = ?", (rs, r) -> rs.getString("id"), req.email());
        if (!existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email is already in use.");
        }

        String[] owner = jdbc.queryForObject(
                "select name, company from login where id = ?",
                (rs, r) -> new String[]{ rs.getString("name"), rs.getString("company") },
                parentLoginId);

        String name = (req.firstName() + " " + req.lastName()).trim();
        try {
            jdbc.update("""
                    insert into login
                        (id, name, company, email, password_hash, plan_id, phone_number,
                         is_subuser, parent_login_id, created_at)
                    values (?, ?, ?, ?, '', 'plan-free', ?, true, ?, now())
                    """,
                    req.email(), name, req.company(), req.email(), req.phone(), parentLoginId);
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email is already in use.");
        }

        emailVerificationService.sendSubUserInviteEmail(req.email(), req.email(), owner[0], owner[1]);

        return new SubUserResponse(
                req.email(), name, req.email(), req.company(), req.phone(), false, OffsetDateTime.now().toInstant());
    }

    public void remove(String parentLoginId, String subUserLoginId) {
        int rows = jdbc.update(
                "delete from login where id = ? and parent_login_id = ?",
                subUserLoginId, parentLoginId);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sub-user not found.");
        }
    }
}
