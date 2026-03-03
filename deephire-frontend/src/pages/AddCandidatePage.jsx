import { Box, Paper, Typography, Grid, TextField, Button } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AddCandidatePage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    linkedinUrl: "",
    cvText: "",
    jobId: "job-1",
  });

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
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
                label="Job ID (MVP)"
                value={form.jobId}
                onChange={(e) => setField("jobId", e.target.value)}
                helperText="Temporary: choose job later via dropdown."
              />
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
              <Button type="submit" variant="contained">Run Analysis</Button>
              <Button variant="outlined" onClick={() => nav("/candidates")}>Cancel</Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
}
