// ── usePlanLimit.js ──────────────────────────────────────────────────────────
// Shared hook that fetches the current user's plan usage.
// Returns { usage, loading, checkJobLimit, checkCandidateLimit }
// where checkJobLimit / checkCandidateLimit return true if limit is NOT reached.

import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export function usePlanLimit() {
  const loginId = localStorage.getItem("loginId") || "";
  const [usage,   setUsage]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = new URL(`${API_BASE}/api/plans/me`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString())
      .then(r => r.json())
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, [loginId]);

  // Returns true if the user can still create a job
  function checkJobLimit() {
    if (!usage) return true; // fail open — don't block if plan data unavailable
    return usage.currentJobs < usage.maxJobs;
  }

  // Returns true if the user can still add a candidate
  function checkCandidateLimit() {
    if (!usage) return true;
    return usage.currentCandidates < usage.maxCandidates;
  }

  return { usage, loading, checkJobLimit, checkCandidateLimit };
}
