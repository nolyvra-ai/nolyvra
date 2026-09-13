import { useEffect, useRef, useState } from "react";
import { Box, Paper, Typography, Button, Checkbox, FormControlLabel, CircularProgress, Alert } from "@mui/material";
import { useParams } from "react-router-dom";

// Public, token-gated page — no auth, no AppShell (see App.jsx PUBLIC_ROUTES
// handling for "/interview/"). Talks straight to /api/public/interview/**,
// which bypasses SessionInterceptor entirely (WebMvcConfig excludes
// "/api/public/**"), so no loginId/session token is ever sent from here.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER = "#E8ECF2", MUTED = "#8A94A6", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", DANGER = "#DC2626";

const RECORDER_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const type of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function PublicInterviewPage() {
  const { token } = useParams();

  const [phase, setPhase] = useState("loading"); // loading | error | intro | interview | thankyou
  const [errorInfo, setErrorInfo] = useState(null);
  const [intro, setIntro] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSecs, setRemainingSecs] = useState(0);
  const [thankYouMessage, setThankYouMessage] = useState("");

  const [micError, setMicError] = useState(null);
  const [recordingState, setRecordingState] = useState("idle"); // idle | recording | recorded
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedSecs, setRecordedSecs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answerWarning, setAnswerWarning] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordStartRef = useRef(null);
  const completingRef = useRef(false); // guards against a manual-Submit / timeout race double-completing

  // ── Load intro data ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/public/interview/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const err = new Error(text || "Unable to load interview.");
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setIntro(data);
        const qs = data.questions || [];
        setQuestions(qs);

        if (data.status === "STARTED") {
          const firstUnanswered = qs.findIndex((q) => !q.answerText);
          const startIndex = firstUnanswered === -1 ? qs.length : firstUnanswered;
          const elapsedSecs = data.consentAt ? (Date.now() - new Date(data.consentAt).getTime()) / 1000 : 0;
          const remaining = data.sessionTimeoutMinutes * 60 - elapsedSecs;
          setCurrentIndex(startIndex);
          setRemainingSecs(Math.max(0, remaining));
          setPhase("interview");
        } else {
          setPhase("intro");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 410) {
          setErrorInfo({ title: "Link expired", message: "This interview link has expired. Please ask your recruiter to send you a new one." });
        } else if (e.status === 409) {
          setErrorInfo({ title: "Already completed", message: "This interview has already been completed. Thank you!" });
        } else {
          setErrorInfo({ title: "Invalid link", message: "This interview link isn't valid. Please check the link or contact your recruiter." });
        }
        setPhase("error");
      });
    return () => { cancelled = true; };
  }, [token]);

  // ── Countdown ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "interview") return;
    const id = setInterval(() => {
      setRemainingSecs((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Fires exactly once, whenever the countdown reaches zero (from a normal
  // countdown, or immediately on a reload where time had already run out) —
  // declared as its own effect (rather than called from inside the interval
  // above) so it always closes over the *current* render's recordedBlob/
  // currentIndex, not whatever they were when the interval was created.
  useEffect(() => {
    if (phase === "interview" && remainingSecs === 0 && !completingRef.current) {
      handleAutoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSecs, phase]);

  function stopMicStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => () => stopMicStream(), []);

  async function startRecording() {
    setMicError(null);
    setAnswerWarning(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError("Audio recording isn't supported in this browser. Please try Chrome, Edge, Safari, or Firefox.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setRecordingState("recorded");
        stopMicStream();
      };
      recordStartRef.current = Date.now();
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
    } catch {
      setMicError("We couldn't access your microphone. Please check your browser's microphone permission and that a microphone is connected, then try again.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setRecordedSecs(Math.round((Date.now() - recordStartRef.current) / 1000));
      mediaRecorderRef.current.stop();
    }
  }

  function reRecord() {
    setRecordedBlob(null);
    setRecordingState("idle");
    setRecordedSecs(0);
    setAnswerWarning(null);
  }

  async function submitCurrentAnswer() {
    if (!recordedBlob) {
      throw new Error("Please record an answer before continuing.");
    }
    const q = questions[currentIndex];
    const form = new FormData();
    form.append("audio", recordedBlob, "answer.webm");
    form.append("questionOrder", String(q.order));
    form.append("durationSecs", String(recordedSecs));
    const res = await fetch(`${API_BASE}/api/public/interview/${token}/answers`, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Failed to submit your answer. Please try again.");
    }
    return res.json();
  }

  async function finishInterview() {
    const res = await fetch(`${API_BASE}/api/public/interview/${token}/complete`, { method: "POST" });
    if (!res.ok) {
      // A parallel auto-submit/manual-Submit race already completed it — treat as success.
      setThankYouMessage("Thanks for completing your interview!");
      setPhase("thankyou");
      return;
    }
    const data = await res.json().catch(() => null);
    setThankYouMessage(data?.thankYouMessage || "Thanks for completing your interview!");
    setPhase("thankyou");
  }

  async function handleNext() {
    setSubmitting(true);
    try {
      await submitCurrentAnswer();
      setRecordedBlob(null);
      setRecordingState("idle");
      setRecordedSecs(0);
      setAnswerWarning(null);
      setMicError(null);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        if (!completingRef.current) {
          completingRef.current = true;
          await finishInterview();
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (e) {
      setAnswerWarning(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAutoSubmit() {
    if (completingRef.current) return;
    completingRef.current = true;
    try {
      // Only flush an already-stopped, not-yet-submitted recording — if the
      // candidate was still mid-recording exactly when time ran out, that
      // last take is lost, but every previously-submitted answer is safe.
      if (recordedBlob) {
        try { await submitCurrentAnswer(); } catch { /* best effort */ }
      }
      await finishInterview();
    } catch {
      setThankYouMessage("Time's up! Your responses have been submitted.");
      setPhase("thankyou");
    }
  }

  function handleStart() {
    setPhase("interview");
    setRemainingSecs((intro?.sessionTimeoutMinutes || 15) * 60);
  }

  // ── Render: loading ───────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#F7F8FA" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  // ── Render: error (invalid / expired / already completed) ─────────────────────
  if (phase === "error") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#F7F8FA", p: 3 }}>
        <Paper elevation={0} sx={{ maxWidth: 440, p: 4, textAlign: "center", border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mb: 1 }}>{errorInfo?.title}</Typography>
          <Typography sx={{ fontSize: 13.5, color: MUTED }}>{errorInfo?.message}</Typography>
        </Paper>
      </Box>
    );
  }

  // ── Render: intro / consent ─────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#F7F8FA", p: 3 }}>
        <Paper elevation={0} sx={{ maxWidth: 520, width: "100%", p: 4, border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT, mb: 1 }}>
            Hi {intro?.candidateFirstName || "there"} 👋
          </Typography>
          <Typography sx={{ fontSize: 14, color: MUTED, mb: 2.5, lineHeight: 1.6 }}>
            Thanks for your interest in the <b style={{ color: TEXT }}>{intro?.jobTitle}</b>
            {intro?.companyName ? <> role at <b style={{ color: TEXT }}>{intro.companyName}</b></> : null}. As the
            next step, we'd like you to complete a short audio interview — you'll answer {questions.length}{" "}
            question{questions.length === 1 ? "" : "s"} by recording short audio responses (no video, nothing to
            schedule). You'll have {intro?.sessionTimeoutMinutes} minutes in total, so find a quiet spot with a
            working microphone.
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: ACCENT, mb: 2.5 }}>
            All the best — start when you're ready.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} />}
            label={
              <Typography sx={{ fontSize: 12.5, color: TEXT }}>
                I consent to my audio answers being recorded and transcribed for this application.
              </Typography>
            }
            sx={{ mb: 2, alignItems: "flex-start" }}
          />
          <Button variant="contained" fullWidth disabled={!consentChecked} onClick={handleStart}
            sx={{ fontSize: 14, fontWeight: 700, textTransform: "none", borderRadius: "8px", py: 1.25,
              bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Start Interview
          </Button>
        </Paper>
      </Box>
    );
  }

  // ── Render: thank you ─────────────────────────────────────────────────────────
  if (phase === "thankyou") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#F7F8FA", p: 3 }}>
        <Paper elevation={0} sx={{ maxWidth: 440, p: 4, textAlign: "center", border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
          <Typography sx={{ fontSize: 36, mb: 1 }}>🎉</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mb: 1 }}>All done!</Typography>
          <Typography sx={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>{thankYouMessage}</Typography>
        </Paper>
      </Box>
    );
  }

  // ── Render: interview (Q&A) ───────────────────────────────────────────────────
  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F8FA", p: 3, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box sx={{ width: "100%", maxWidth: 560, display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: MUTED }}>
          Question {Math.min(currentIndex + 1, questions.length)} of {questions.length}
        </Typography>
        <Box sx={{ fontSize: 13, fontWeight: 700, color: remainingSecs <= 60 ? DANGER : TEXT,
          bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: "20px", px: 1.5, py: 0.5 }}>
          ⏱ {formatTime(remainingSecs)}
        </Box>
      </Box>

      <Paper elevation={0} sx={{ maxWidth: 560, width: "100%", p: 4, border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
        {!q ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : (
          <>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: TEXT, mb: 3, lineHeight: 1.5 }}>
              {q.question}
            </Typography>

            {micError && <Alert severity="error" sx={{ mb: 2, fontSize: 12.5 }}>{micError}</Alert>}
            {answerWarning && <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>{answerWarning}</Alert>}

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 2 }}>
              {recordingState === "idle" && (
                <Button variant="contained" onClick={startRecording}
                  sx={{ borderRadius: "50px", px: 3, py: 1.25, fontSize: 13, fontWeight: 700, textTransform: "none",
                    bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                  🎙 Record Answer
                </Button>
              )}
              {recordingState === "recording" && (
                <Button variant="contained" onClick={stopRecording}
                  sx={{ borderRadius: "50px", px: 3, py: 1.25, fontSize: 13, fontWeight: 700, textTransform: "none",
                    bgcolor: DANGER, boxShadow: "none", "&:hover": { bgcolor: "#B91C1C", boxShadow: "none" } }}>
                  ⏹ Stop Recording
                </Button>
              )}
              {recordingState === "recorded" && (
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <Typography sx={{ fontSize: 12.5, color: SUCCESS, fontWeight: 600 }}>
                    ✓ Answer recorded ({recordedSecs}s)
                  </Typography>
                  <Button size="small" variant="outlined" onClick={reRecord}
                    sx={{ fontSize: 11.5, textTransform: "none", borderRadius: "6px", borderColor: BORDER, color: TEXT }}>
                    ↻ Re-record
                  </Button>
                </Box>
              )}
            </Box>

            <Button variant="contained" fullWidth disabled={submitting || recordingState === "recording"} onClick={handleNext}
              sx={{ fontSize: 14, fontWeight: 700, textTransform: "none", borderRadius: "8px", py: 1.25, mt: 1,
                bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
              {submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : isLast ? "Submit" : "Next"}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
