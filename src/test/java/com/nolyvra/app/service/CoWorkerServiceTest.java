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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CoWorkerServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CoWorkerAiClient aiClient = mock(CoWorkerAiClient.class);
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
                new ObjectMapper(),
                jdbc,
                aiClient,
                null,
                analysisExecutor,
                jobService,
                candidateService,
                planService);
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
                        null,
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
        MockCoWorkerAiClient mockClient = new MockCoWorkerAiClient(jdbc);

        CoWorkerChatResponse response = mockClient.chat(
                "local@nolyvra.test",
                42L,
                "Create a job for Senior Backend Engineer",
                "",
                List.of());

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

    @Test
    void chatSummarisesPipelineMovementWithoutCallingAi() {
        when(jdbc.query(contains("select id, title, company from jobs"), anyStringMapper(), eq("local@nolyvra.test")))
                .thenReturn(List.of());
        when(jdbc.query(contains("from candidates c\njoin jobs j"), anyStringMapper(), eq("local@nolyvra.test")))
                .thenReturn(List.of());
        when(jdbc.query(contains("from interviews i"), anyStringMapper(), eq("local@nolyvra.test")))
                .thenReturn(List.of());
        when(jdbc.queryForObject(contains("event_type = 'STAGE_CHANGED'"), eq(Integer.class), eq("local@nolyvra.test")))
                .thenReturn(3);
        when(jdbc.queryForObject(contains("event_type = 'CANDIDATE_ADDED'"), eq(Integer.class), eq("local@nolyvra.test")))
                .thenReturn(2);

        Map<String, Object> stage = new LinkedHashMap<>();
        stage.put("stage", "Interview");
        stage.put("count", 2);
        doReturn(List.of(stage)).when(jdbc)
                .query(contains("group by stage"), anyMapMapper(), eq("local@nolyvra.test"));

        Map<String, Object> movement = new LinkedHashMap<>();
        movement.put("name", "Ava Smith");
        movement.put("jobTitle", "Backend Engineer");
        movement.put("stage", "Interview");
        movement.put("note", "Stage updated to: Interview");
        movement.put("movedAt", OffsetDateTime.now(ZoneOffset.UTC));
        doReturn(List.of(movement)).when(jdbc)
                .query(contains("order by a.created_at desc"), anyMapMapper(), eq("local@nolyvra.test"));

        Map<String, Object> stalled = new LinkedHashMap<>();
        stalled.put("id", "cand-1");
        stalled.put("name", "Ben Lee");
        stalled.put("stage", "Screening");
        stalled.put("jobTitle", "Backend Engineer");
        stalled.put("lastActivity", OffsetDateTime.now(ZoneOffset.UTC).minusDays(8));
        stalled.put("daysStalled", 8);
        doReturn(List.of(stalled)).when(jdbc)
                .query(contains("days_stalled"), anyMapMapper(), eq("local@nolyvra.test"));

        CoWorkerChatResponse response = service.chat(
                "local@nolyvra.test",
                new CoWorkerChatRequest(
                        42L,
                        "Summarise this week's pipeline movement and flag stalled candidates",
                        List.of()));

        assertEquals(true, response.message().contains("3 stage change(s)"));
        assertEquals(true, response.message().contains("Ben Lee"));
        verify(aiClient, never()).chat(anyString(), any(), anyString(), anyString(), anyList());
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<Object> anyTaskMapper() {
        return any(RowMapper.class);
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<String> anyStringMapper() {
        return any(RowMapper.class);
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<Map<String, Object>> anyMapMapper() {
        return any(RowMapper.class);
    }
}
