package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.config.CoWorkerAnalysisExecutor;
import com.nolyvra.app.model.CoWorkerChatRequest;
import com.nolyvra.app.model.CoWorkerChatResponse;
import com.nolyvra.app.model.CoWorkerConfirmRequest;
import com.nolyvra.app.model.JobCreateRequest;
import com.nolyvra.app.model.JobResponse;
import com.nolyvra.app.model.CandidateCreateRequest;
import com.nolyvra.app.model.CandidateResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CoWorkerServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final JobService jobService = mock(JobService.class);
    private final CandidateService candidateService = mock(CandidateService.class);
    private final PlanService planService = mock(PlanService.class);
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
                jobService,
                candidateService,
                planService,
                "gpt-4o-mini",
                false);
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

    @Test
    void confirmCreateJobDelegatesToJobServiceAndReturnsNavigation() {
        when(planService.isJobLimitReached("local@nolyvra.test")).thenReturn(false);
        when(jobService.createJob(any(JobCreateRequest.class), eq("local@nolyvra.test")))
                .thenReturn(new JobResponse(
                        "job-123",
                        "Senior Backend Engineer",
                        "Nolyvra",
                        "Full-time",
                        "Senior",
                        "Build APIs",
                        "Melbourne",
                        List.of("Java", "Spring Boot"),
                        Instant.now(),
                        "Active",
                        null,
                        "AUD",
                        null,
                        null));

        Map<String, Object> result = service.confirmAction(
                "local@nolyvra.test",
                new CoWorkerConfirmRequest("CREATE_JOB", Map.of(
                        "title", "Senior Backend Engineer",
                        "company", "Nolyvra",
                        "jobType", "Full-time",
                        "seniority", "Senior",
                        "jdText", "Build APIs",
                        "location", "Melbourne",
                        "stackTags", List.of("Java", "Spring Boot"),
                        "currency", "AUD")));

        verify(jobService).createJob(argThat(req ->
                        req.title().equals("Senior Backend Engineer")
                                && req.jdText().equals("Build APIs")
                                && req.stackTags().equals(List.of("Java", "Spring Boot"))),
                eq("local@nolyvra.test"));
        assertEquals(true, result.get("success"));
        assertEquals("/jobs/job-123/add-candidates-modern", result.get("navigateTo"));
    }

    @Test
    void confirmCreateJobRespectsJobLimit() {
        when(planService.isJobLimitReached("local@nolyvra.test")).thenReturn(true);

        Map<String, Object> result = service.confirmAction(
                "local@nolyvra.test",
                new CoWorkerConfirmRequest("CREATE_JOB", Map.of(
                        "title", "Senior Backend Engineer",
                        "jdText", "Build APIs")));

        verify(jobService, never()).createJob(any(), anyString());
        assertEquals(false, result.get("success"));
    }

    @Test
    void mockChatCanReturnCreateJobAction() {
        CoWorkerAnalysisExecutor analysisExecutor = mock(CoWorkerAnalysisExecutor.class);
        when(analysisExecutor.executorService()).thenReturn(analysisPool);
        CoWorkerService mockService = new CoWorkerService(
                null,
                new ObjectMapper(),
                jdbc,
                null,
                null,
                analysisExecutor,
                jobService,
                candidateService,
                planService,
                "gpt-4o-mini",
                true);

        CoWorkerChatResponse response = mockService.chat(
                "local@nolyvra.test",
                new CoWorkerChatRequest(
                        42L,
                        "Create a job for Senior Backend Engineer",
                        List.of()));

        assertEquals("CREATE_JOB", response.pendingAction().type());
        assertEquals("Senior Backend Engineer", response.pendingAction().params().get("title"));
    }

    @Test
    void confirmAddCandidatesCreatesCandidateForJob() {
        when(planService.isCandidateLimitReached("local@nolyvra.test")).thenReturn(false);
        when(candidateService.addCandidate(eq("job-123"), any(CandidateCreateRequest.class), eq("local@nolyvra.test")))
                .thenReturn(new CandidateResponse(
                        "cand-123",
                        "job-123",
                        "Ava Smith",
                        "ava@example.com",
                        "",
                        "",
                        Instant.now(),
                        "Screening",
                        "Professional experience with Java and Spring Boot. Education Bachelor degree. Skills Java SQL AWS.",
                        List.of("Java", "Spring Boot"),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null));

        Map<String, Object> result = service.confirmAction(
                "local@nolyvra.test",
                new CoWorkerConfirmRequest("ADD_CANDIDATES", Map.of(
                        "jobId", "job-123",
                        "jobTitle", "Backend Engineer",
                        "candidates", List.of(Map.of(
                                "name", "Ava Smith",
                                "email", "ava@example.com",
                                "cvText", "Professional experience with Java and Spring Boot. Education Bachelor degree. Skills Java SQL AWS.",
                                "skills", List.of("Java", "Spring Boot"))))));

        verify(candidateService).addCandidate(eq("job-123"), argThat(req ->
                        req.name().equals("Ava Smith")
                                && req.email().equals("ava@example.com")
                                && req.skills().equals(List.of("Java", "Spring Boot"))),
                eq("local@nolyvra.test"));
        assertEquals(true, result.get("success"));
        assertEquals(1, result.get("created"));
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<Object> anyTaskMapper() {
        return any(RowMapper.class);
    }
}
