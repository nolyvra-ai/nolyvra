import { Box, Paper, Typography, Grid, TextField, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { MenuItem } from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
}

export default function AddCandidatePage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    linkedinUrl: "",
    cvText: "",
    jobId: "job-1",
  });
  const [jobs, setJobs] = useState([]);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  useEffect(() => {
    async function loadJobs() {
      try {
        const data = await apiGet("/api/jobs");
        setJobs(data ?? []);
      } catch (e) {
        console.error("Failed to load jobs", e);
      }
    }

    loadJobs();
  }, []);

  async function onSave(e) {
    e.preventDefault();

    try {
      await apiPost(`/api/jobs/${form.jobId}/candidates`, {
        name: form.name,
        email: form.email,
        linkedinUrl: form.linkedinUrl,
        cvText: form.cvText,
      });

      nav("/candidates");
    } catch (e) {
      console.error("Failed to save candidate", e);
      alert("Failed to save candidate");
    }
  }

  function onSubmit(e) {
    e.preventDefault();

    // MVP: no API call yet. Later:
    // 1) POST /api/jobs/{jobId}/candidates
    // 2) POST /api/candidates/{candidateId}/analyze
    //
    // For now navigate to an existing mock analysis candidate:
    nav(`/analysis/cand-123`);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Add Candidate</Typography>
        <Typography variant="body2" color="text.secondary">
          MVP v1 uses CV text only. Please remove candidate PII before pasting.
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Candidate Name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email (optional)"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="LinkedIn URL"
                value={form.linkedinUrl}
                onChange={(e) => setField("linkedinUrl", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Job"
                value={form.jobId}
                onChange={(e) => setField("jobId", e.target.value)}
              >
                {jobs.map((job) => (
                  <MenuItem key={job.id} value={job.id}>
                    {job.title}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Paste CV Text (redacted)"
                value={form.cvText}
                onChange={(e) => setField("cvText", e.target.value)}
                multiline
                minRows={12}
              />
            </Grid>

            <Grid item xs={12} sx={{ display: "flex", gap: 1 }}>
              <Button variant="contained" onClick={onSave}>
                Save
              </Button>
              <Button type="submit" variant="outlined">
                Run Analysis
              </Button>
              <Button variant="outlined" onClick={() => nav("/candidates")}>
                Cancel
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
}
