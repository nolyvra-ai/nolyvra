package com.depthhire.app.controller;

import com.depthhire.app.model.CandidateAnalysisResponse;
import com.depthhire.app.store.InMemoryStore;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AnalysisController {

  private final InMemoryStore store;

  public AnalysisController(InMemoryStore store) {
    this.store = store;
  }

  @PostMapping("/candidates/{candidateId}/analyze")
  public CandidateAnalysisResponse analyze(@PathVariable String candidateId) {
    var candidate = store.getCandidate(candidateId)
        .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
    var jobId = store.getCandidateJobId(candidateId)
        .orElseThrow(() -> new IllegalArgumentException("Candidate has no job: " + candidateId));

    // Dummy data you can tweak anytime
    var scores = new CandidateAnalysisResponse.Scores(
        78, // consistencyScore
        68, // capabilityScore
        "Medium"
    );

    var flags = List.of(
        new CandidateAnalysisResponse.Consistency.Flag(
            "Medium",
            "TITLE_MISMATCH",
            "CV lists 'Senior Backend Engineer' for 2021, LinkedIn shows 'Software Engineer'."
        ),
        new CandidateAnalysisResponse.Consistency.Flag(
            "Low",
            "DATE_MISMATCH",
            "CV shows end date Mar 2023, LinkedIn shows Present (might be outdated profile)."
        )
    );

    var consistency = new CandidateAnalysisResponse.Consistency(
        90,
        flags
    );

    var matrixRows = List.of(
        new CandidateAnalysisResponse.CapabilityMatrix.Row("System Design", 30, 70, "Medium"),
        new CandidateAnalysisResponse.CapabilityMatrix.Row("Cloud Architecture", 25, 60, "High"),
        new CandidateAnalysisResponse.CapabilityMatrix.Row("Leadership", 20, 40, "High"),
        new CandidateAnalysisResponse.CapabilityMatrix.Row("Domain Knowledge", 25, 80, "Low")
    );

    var capabilityMatrix = new CandidateAnalysisResponse.CapabilityMatrix(
        matrixRows,
        Map.of("System Design", 30, "Cloud Architecture", 25, "Leadership", 20, "Domain Knowledge", 25)
    );

    var questions = List.of(
        new CandidateAnalysisResponse.SuggestedQuestion(
            1,
            "system_design",
            "Validate ownership + rollout strategy",
            "Walk me through the microservices migration you mentioned. What was the rollout and rollback plan?"
        ),
        new CandidateAnalysisResponse.SuggestedQuestion(
            2,
            "architecture",
            "Validate scale experience with concrete metrics",
            "What was peak load (QPS/throughput) in your last system, and what bottlenecks did you address?"
        ),
        new CandidateAnalysisResponse.SuggestedQuestion(
            3,
            "behavioral",
            "Validate leadership maturity under pressure",
            "Tell me about a production incident you were responsible for. What decisions did you make and why?"
        ),
        new CandidateAnalysisResponse.SuggestedQuestion(
            4,
            "debugging",
            "Validate practical troubleshooting approach",
            "If p95 latency doubles after a new release, how would you isolate whether it’s DB, network, or code?"
        )
    );

    var riskFlags = List.of(
        "No clear evidence of owning end-to-end architecture decisions.",
        "Scale claims lack metrics (users/QPS/data volume).",
        "Leadership scope appears limited to task coordination."
    );

    return new CandidateAnalysisResponse(
        candidateId,
        jobId,
        Instant.now(),
        scores,
        consistency,
        capabilityMatrix,
        questions,
        riskFlags,
        "Proceed to interview, but probe architecture ownership and scale."
    );
  }

  @GetMapping("/candidates/{candidateId}/analysis")
  public CandidateAnalysisResponse getAnalysis(@PathVariable String candidateId) {
    // For MVP, just return the same dummy analysis
    return analyze(candidateId);
  }
}
