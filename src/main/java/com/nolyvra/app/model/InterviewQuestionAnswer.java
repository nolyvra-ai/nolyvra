package com.nolyvra.app.model;

// One entry of the frozen questions_snapshot on interview_session — the
// question as it existed at Start/Regenerate time, plus the candidate's
// answer once recorded. answerText/durationSecs stay null until the
// candidate submits audio for this question.
public record InterviewQuestionAnswer(
        int order,
        String question,
        String answerText,
        Integer durationSecs
) {}
