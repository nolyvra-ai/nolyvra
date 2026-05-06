package com.nolyvra.app.config;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class CoWorkerAnalysisExecutor {

    private final ExecutorService executorService;

    public CoWorkerAnalysisExecutor(@Value("${coworker.analysis-pool-size:3}") int poolSize) {
        if (poolSize < 1) {
            throw new IllegalArgumentException("coworker.analysis-pool-size must be at least 1");
        }
        this.executorService = Executors.newFixedThreadPool(poolSize);
    }

    public ExecutorService executorService() {
        return executorService;
    }

    @PreDestroy
    public void shutdown() {
        executorService.shutdown();
    }
}
