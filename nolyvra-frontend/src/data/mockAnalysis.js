export const mockAnalysis = {
  candidateId: "cand-123",
  jobId: "job-1",
  analyzedAt: "2026-02-28T10:42:00Z",
  scores: { consistencyScore: 87, capabilityScore: 72, riskLevel: "High", confidence: "Medium" },
  confidenceReason: "LinkedIn summary is strong but role scope is not fully quantified in CV.",
  executionDepth: { tier: "Owner", rationale: "Describes leading migration and mentoring; unclear on org-level strategy decisions." },

  topStrengthSignals: [
    "Led migration from monolith to microservices",
    "Built payment services processing ~800K transactions/day",
    "Mentored 3 junior engineers"
  ],

  riskAnalysis: [
    { level: "High", title: "Scale authenticity", detail: "Scale claims present but limited metrics on latency/SLOs and infra topology." },
    { level: "Medium", title: "Title mismatch risk", detail: "CV: Senior Software Engineer; LinkedIn: Software Engineer (may be outdated)." },
    { level: "Low", title: "Retention risk", detail: "Tenure history looks stable; no frequent short stints." }
  ],

  capabilityMatrix: [
    { capability: "Backend Architecture", weightPercent: 30, scorePercent: 80, insight: "Strong service design + API ownership" },
    { capability: "Cloud & Infrastructure", weightPercent: 20, scorePercent: 60, insight: "AWS present; limited k8s depth" },
    { capability: "Distributed Systems", weightPercent: 20, scorePercent: 70, insight: "Kafka mentioned; probe ordering & retries" },
    { capability: "Leadership & Mentorship", weightPercent: 15, scorePercent: 75, insight: "Mentoring + reviews; probe influence" },
    { capability: "Domain (FinTech)", weightPercent: 15, scorePercent: 55, insight: "Some payments context; probe compliance" }
  ],

  suggestedQuestions: [
    {
      category: "Architecture",
      question: "Walk me through the monolith → microservices migration. What were the rollout and rollback strategies?",
      why: "Validates ownership depth and real migration experience.",
      strongSignals: "Clear phased rollout, feature flags, data migration plan, rollback drills, incident learnings."
    },
    {
      category: "Technical",
      question: "What was the peak throughput (QPS/txn/sec) and what bottlenecks did you remove first?",
      why: "Tests scale authenticity and prioritization under pressure.",
      strongSignals: "Mentions metrics, profiling, DB indexing, caching, queues, p95/p99 latency, SLOs."
    },
    {
      category: "Risk Validation",
      question: "Your CV and LinkedIn titles differ for the same period. What’s the correct title and why the mismatch?",
      why: "Closes consistency gap quickly.",
      strongSignals: "Simple explanation (promotion timing / stale LinkedIn) with consistent dates."
    },
    {
      category: "Behavioral",
      question: "Describe a production incident you owned. What did you decide in the first 15 minutes?",
      why: "Decision-making under pressure + leadership maturity.",
      strongSignals: "Triage, comms, rollback decision, hypothesis-driven debugging, postmortem."
    },
    {
      category: "Domain",
      question: "In payments, how do you handle idempotency and duplicate processing?",
      why: "Validates real fintech domain depth.",
      strongSignals: "Idempotency keys, dedupe store, exactly-once semantics tradeoffs, retries, reconciliation."
    },
    {
      category: "Technical",
      question: "How would you design retries and DLQ strategy for Kafka consumers in a payment pipeline?",
      why: "Tests distributed systems rigor.",
      strongSignals: "Backoff, poison messages, DLQ, reprocessing, ordering, transactional outbox patterns."
    }
  ]
};
