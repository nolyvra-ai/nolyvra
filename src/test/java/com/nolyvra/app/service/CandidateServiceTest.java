package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateListItemResponse;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CandidateServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final JobApplicationService jobApplicationService = mock(JobApplicationService.class);
    private final CandidateImportService candidateImportService = mock(CandidateImportService.class);
    private final CandidateService service =
            new CandidateService(jdbc, new ObjectMapper(), jobApplicationService, candidateImportService);

    @Test
    void getCandidateListUsesLightweightQueryAndMapsLatestAnalysis() {
        when(jdbc.query(anyString(), anyCandidateListMapper(), eq("local@nolyvra.test")))
                .thenAnswer(invocation -> {
                    RowMapper<CandidateListItemResponse> mapper = invocation.getArgument(1);
                    ResultSet rs = mock(ResultSet.class);
                    OffsetDateTime createdAt = OffsetDateTime.parse("2026-06-13T10:15:30+10:00");

                    when(rs.getString("id")).thenReturn("cand-1");
                    when(rs.getString("job_id")).thenReturn("job-1");
                    when(rs.getString("job_title")).thenReturn("Backend Engineer");
                    when(rs.getString("job_company")).thenReturn("Nolyvra");
                    when(rs.getString("name")).thenReturn("Daniel Chen");
                    when(rs.getString("email")).thenReturn("daniel@example.test");
                    when(rs.getString("linkedin_url")).thenReturn("https://linkedin.example/daniel");
                    when(rs.getObject("created_at", OffsetDateTime.class)).thenReturn(createdAt);
                    when(rs.getString("stage")).thenReturn("Screening");
                    when(rs.getObject("analysis_id")).thenReturn(42L);
                    when(rs.getObject("consistency_score")).thenReturn(81);
                    when(rs.getObject("capability_score")).thenReturn(88);
                    when(rs.getString("risk_level")).thenReturn("Low");
                    when(rs.getObject("timeline_match_percent")).thenReturn(79);

                    return List.of(mapper.mapRow(rs, 0));
                });

        List<CandidateListItemResponse> result = service.getCandidateList("local@nolyvra.test");

        assertThat(result).hasSize(1);
        CandidateListItemResponse row = result.getFirst();
        assertThat(row.id()).isEqualTo("cand-1");
        assertThat(row.jobTitle()).isEqualTo("Backend Engineer");
        assertThat(row.capabilityScore()).isEqualTo(88);
        assertThat(row.riskLevel()).isEqualTo("Low");
        assertThat(row.status()).isEqualTo("Analysed");

        verify(jdbc).query(
                argThat(sql -> sql.contains("left join lateral")
                        && sql.contains("login_id = c.login_id")
                        && sql.contains("order by c.created_at desc")
                        && !sql.contains("cv_text")),
                anyCandidateListMapper(),
                eq("local@nolyvra.test"));
    }

    @Test
    void getActiveCandidateCountUsesCountOnlyQuery() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("local@nolyvra.test")))
                .thenReturn(7);

        int count = service.getActiveCandidateCount("local@nolyvra.test");

        assertThat(count).isEqualTo(7);
        verify(jdbc).queryForObject(
                argThat(sql -> sql.contains("select count(*)")
                        && sql.contains("is_active = true")
                        && !sql.contains("cv_text")),
                eq(Integer.class),
                eq("local@nolyvra.test"));
    }

    @SuppressWarnings("unchecked")
    private static RowMapper<CandidateListItemResponse> anyCandidateListMapper() {
        return any(RowMapper.class);
    }
}
