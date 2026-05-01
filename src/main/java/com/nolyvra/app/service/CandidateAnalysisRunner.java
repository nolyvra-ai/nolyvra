package com.nolyvra.app.service;

import com.nolyvra.app.model.CandidateAnalysisResponse;
import com.nolyvra.app.model.CandidateResponse;

public interface CandidateAnalysisRunner {
    CandidateAnalysisResponse analyze(
            String candidateId,
            CandidateResponse candidate,
            String loginId,
            String jdText,
            String cvText,
            String linkedinUrl);
}

