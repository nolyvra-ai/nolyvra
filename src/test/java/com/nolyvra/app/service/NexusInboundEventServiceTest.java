package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NexusInboundEventServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final NexusInboundEventService service = new NexusInboundEventService(jdbc);

    @Test
    void newEventIdReturnsTrue() {
        when(jdbc.update(anyString(), anyString(), anyString())).thenReturn(1);

        boolean isNew = service.recordIfNew("11111111-1111-1111-1111-111111111111", "message.received");

        assertThat(isNew).isTrue();
    }

    @Test
    void replayedEventIdReturnsFalse() {
        when(jdbc.update(anyString(), anyString(), anyString())).thenReturn(0);

        boolean isNew = service.recordIfNew("11111111-1111-1111-1111-111111111111", "message.received");

        assertThat(isNew).isFalse();
    }
}
