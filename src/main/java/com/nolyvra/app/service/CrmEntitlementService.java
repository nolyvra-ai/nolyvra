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
            if (isMissingColumn(e, "crm_enabled")) {
                return true;
            }
            throw e;
        }
    }

    /** Throws 403 if the login does not have the Grievances feature enabled. */
    public void checkGrievanceEntitled(String loginId) {
        Boolean enabled = grievanceEnabled(loginId);
        if (!Boolean.TRUE.equals(enabled)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Grievances feature is not enabled for this account");
        }
    }

    /** Non-throwing version for UI checks. */
    public boolean isGrievanceEntitled(String loginId) {
        try {
            Boolean enabled = grievanceEnabled(loginId);
            return Boolean.TRUE.equals(enabled);
        } catch (Exception e) {
            return false;
        }
    }

    private Boolean grievanceEnabled(String loginId) {
        try {
            return jdbc.queryForObject(
                    "SELECT grievance_enabled FROM login WHERE id = ?",
                    Boolean.class, loginId);
        } catch (BadSqlGrammarException e) {
            if (isMissingColumn(e, "grievance_enabled")) {
                return true;
            }
            throw e;
        }
    }

    private boolean isMissingColumn(BadSqlGrammarException e, String columnName) {
        String message = e.getMessage();
        return message != null && message.contains(columnName);
    }
}
