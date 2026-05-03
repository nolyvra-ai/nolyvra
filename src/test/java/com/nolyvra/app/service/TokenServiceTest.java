package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class TokenServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TokenService service = new TokenService(jdbc);

    @Test
    void deductTokenUsesAtomicConditionalUpdate() {
        when(jdbc.update(contains("tokens_remaining >= ?"), eq(10), eq("local@nolyvra.test"), eq(10)))
                .thenReturn(1);

        boolean deducted = service.deductToken("local@nolyvra.test");

        assertThat(deducted).isTrue();
        verify(jdbc).update(
                contains("tokens_remaining >= ?"),
                eq(10),
                eq("local@nolyvra.test"),
                eq(10));
    }

    @Test
    void deductTokenReturnsFalseWhenInsufficientTokens() {
        when(jdbc.update(contains("tokens_remaining >= ?"), eq(10), eq("local@nolyvra.test"), eq(10)))
                .thenReturn(0);

        assertThat(service.deductToken("local@nolyvra.test")).isFalse();
    }

    @Test
    void deductTokenFailsClosedOnDatabaseError() {
        when(jdbc.update(contains("tokens_remaining >= ?"), eq(10), eq("local@nolyvra.test"), eq(10)))
                .thenThrow(new RuntimeException("database down"));

        assertThat(service.deductToken("local@nolyvra.test")).isFalse();
    }
}
