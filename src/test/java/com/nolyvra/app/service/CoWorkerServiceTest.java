package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CoWorkerServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CoWorkerService service = new CoWorkerService(
            null,
            new ObjectMapper(),
            jdbc,
            null,
            null,
            "gpt-4o-mini");

    @Test
    void getTasksUsesParameterizedStatusFilter() {
        when(jdbc.query(anyString(), anyTaskMapper(), any(), any())).thenReturn(List.of());

        service.getTasks("local@nolyvra.test", "running");

        verify(jdbc).query(
                contains("where login_id = ? and status = ?"),
                anyTaskMapper(),
                eq("local@nolyvra.test"),
                eq("running"));
    }

    @Test
    void getTasksTreatsInjectedStatusAsParameterNotSql() {
        when(jdbc.query(anyString(), anyTaskMapper(), any(), any())).thenReturn(List.of());

        service.getTasks("local@nolyvra.test", "running' or '1'='1");

        verify(jdbc).query(
                contains("where login_id = ? and status = ?"),
                anyTaskMapper(),
                eq("local@nolyvra.test"),
                eq("__invalid__"));
        verify(jdbc, never()).query(
                contains("running' or '1'='1"),
                anyTaskMapper(),
                any(),
                any());
    }

    @Test
    void getTasksWithoutStatusDoesNotAddStatusFilter() {
        when(jdbc.query(anyString(), anyTaskMapper(), any())).thenReturn(List.of());

        service.getTasks("local@nolyvra.test", "all");

        verify(jdbc).query(
                argThat(sql -> sql.contains("where login_id = ?") && !sql.contains("status = ?")),
                anyTaskMapper(),
                eq("local@nolyvra.test"));
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<Object> anyTaskMapper() {
        return any(RowMapper.class);
    }
}
