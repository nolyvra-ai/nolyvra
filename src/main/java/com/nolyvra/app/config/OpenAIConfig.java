package com.nolyvra.app.config;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenAIConfig {

    @Bean
    public OpenAIClient openAIClient(
            @Value("${openai.api-key:}") String apiKey,
            @Value("${nolyvra.mock-ai:false}") boolean mockAi
    ) {

        if (apiKey == null || apiKey.isBlank()) {
            if (!mockAi) {
                throw new IllegalStateException("openai.api-key is missing in application.yml");
            }
            apiKey = "sk-local-placeholder";
        }

        return OpenAIOkHttpClient.builder()
                .apiKey(apiKey)
                .build();
    }
}
