package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.config.CoWorkerAnalysisExecutor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CoWorkerServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private ExecutorService analysisPool;
    private CoWorkerService service;

    @BeforeEach
    void setUp() {
        analysisPool = Executors.newSingleThreadExecutor();
        CoWorkerAnalysisExecutor analysisExecutor = mock(CoWorkerAnalysisExecutor.class);
        when(analysisExecutor.executorService()).thenReturn(analysisPool);

        service = new CoWorkerService(
                null,
                new ObjectMapper(),
                jdbc,
                null,
                null,
                analysisExecutor,
                "gpt-4o-mini");
    }

    @AfterEach
    void tearDown() {
        analysisPool.shutdownNow();
    }

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
