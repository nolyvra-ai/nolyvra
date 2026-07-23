package com.nolyvra.app.store;

import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.JobResponse;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryStore {
  private final Map<String, JobResponse> jobs = new ConcurrentHashMap<>();
  private final Map<String, CandidateResponse> candidates = new ConcurrentHashMap<>();
  private final Map<String, String> candidateToJob = new ConcurrentHashMap<>();

  public JobResponse saveJob(String title, String company, String jobType, String seniority, String jdText, String location, List<String> stackTags, String jobStatus) {
    String id = UUID.randomUUID().toString();
    JobResponse job = new JobResponse(id, title, company, jobType, seniority, jdText,location,stackTags, Instant.now(), jobStatus, null, null, null, null, null, null);
    jobs.put(id, job);
    return job;
  }

  public Optional<JobResponse> getJob(String id) {
    return Optional.ofNullable(jobs.get(id));
  }

  public List<JobResponse> listJobs() {
    return jobs.values().stream()
        .sorted(Comparator.comparing(JobResponse::createdAt).reversed())
        .toList();
  }

  public CandidateResponse saveCandidate(String jobId, String name, String email, String linkedinUrl, String stage, String cvText) {
    String id = UUID.randomUUID().toString();
    CandidateResponse c = new CandidateResponse(id, jobId, name, email, null, linkedinUrl, Instant.now(), stage, cvText,
        null, null, null, null, null, null, null, null, null, null, null, null, null);
    candidates.put(id, c);
    candidateToJob.put(id, jobId);
    return c;
  }

  public Optional<CandidateResponse> getCandidate(String id) {
    return Optional.ofNullable(candidates.get(id));
  }

  public Optional<String> getCandidateJobId(String candidateId) {
    return Optional.ofNullable(candidateToJob.get(candidateId));
  }
}
