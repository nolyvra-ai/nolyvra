package com.nolyvra.app.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CrmEntitlementService {

    private final JdbcTemplate jdbc;

    public CrmEntitlementService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Throws 403 if the login does not have the CRMx module enabled. */
    public void checkEntitled(String loginId) {
        Boolean enabled = crmEnabled(loginId);
        if (!Boolean.TRUE.equals(enabled)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "CRMx module is not enabled for this account");
        }
    }

    /** Non-throwing version for UI checks. */
    public boolean isEntitled(String loginId) {
        try {
            Boolean enabled = crmEnabled(loginId);
            return Boolean.TRUE.equals(enabled);
        } catch (Exception e) {
            return false;
        }
    }

    private Boolean crmEnabled(String loginId) {
        try {
            return jdbc.queryForObject(
                    "SELECT crm_enabled FROM login WHERE id = ?",
                    Boolean.class, loginId);
        } catch (BadSqlGrammarException e) {
            if (isMissingCrmEnabledColumn(e)) {
                return true;
            }
            throw e;
        }
    }

    private boolean isMissingCrmEnabledColumn(BadSqlGrammarException e) {
        String message = e.getMessage();
        return message != null && message.contains("crm_enabled");
    }
}
