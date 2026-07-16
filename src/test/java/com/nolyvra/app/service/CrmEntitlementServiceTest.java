package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CrmEntitlementServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CrmEntitlementService service = new CrmEntitlementService(jdbc);

    @Test
    void missingCrmEnabledColumnDefaultsToEnabledForLegacyLocalSchemas() {
        when(jdbc.queryForObject(
                "SELECT crm_enabled FROM login WHERE id = ?",
                Boolean.class, "login-1"))
                .thenThrow(new BadSqlGrammarException(
                        "select", "SELECT crm_enabled FROM login WHERE id = ?",
                        new SQLException("ERROR: column \"crm_enabled\" does not exist")));

        assertThat(service.isEntitled("login-1")).isTrue();
        service.checkEntitled("login-1");
    }

    @Test
    void explicitDisabledAccountIsForbidden() {
        when(jdbc.queryForObject(
                "SELECT crm_enabled FROM login WHERE id = ?",
                Boolean.class, "login-1"))
                .thenReturn(false);

        assertThat(service.isEntitled("login-1")).isFalse();
        assertThatThrownBy(() -> service.checkEntitled("login-1"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("CRMx module is not enabled");
    }
}
