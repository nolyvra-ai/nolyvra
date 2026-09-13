package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class JobCountTest {
    @Test
    void countsOnlyActiveJobsForTheRequestedLoginWithoutLoadingDetails() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        JobService service = new JobService(jdbc, mock(OpenAIClient.class),
                new ObjectMapper(), mock(TokenService.class), "gpt-4o-mini");
        String sql = "select count(*) from jobs where login_id = ? and is_active = true";
        when(jdbc.queryForObject(sql, Long.class, "recruiter-a")).thenReturn(42L);
        assertEquals(42L, service.countJobs("recruiter-a"));
        verify(jdbc).queryForObject(sql, Long.class, "recruiter-a");
        verifyNoMoreInteractions(jdbc);
    }
}
