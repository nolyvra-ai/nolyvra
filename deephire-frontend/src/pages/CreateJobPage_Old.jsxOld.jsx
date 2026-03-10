import { Box, Paper, Typography, Grid, TextField, Button, Chip } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

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

export default function CreateJobPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    jobType: "Hybrid",
    jdText: "",
    tags: "Java, Spring Boot, AWS, Kafka, Postgres",
  });

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const tagList = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function onSubmit(e) {
    e.preventDefault();

    try {
      await apiPost("/api/jobs", {
        title: form.title,
        company: form.company,
        jobType: form.jobType,
        seniority: "",
        jdText: form.jdText,
        location: form.location,
        stackTags: tagList,
      });

      nav("/jobs");
    } catch (err) {
      console.error("Failed to create job", err);
      alert("Failed to save job");
    }
  }


  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Create Job</Typography>
        <Typography variant="body2" color="text.secondary">
          Paste a JD and define the role context for analysis.
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Job Title"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company"
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Location"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Job Type"
                value={form.jobType}
                onChange={(e) => setField("jobType", e.target.value)}
                helperText="Remote / Hybrid / Onsite"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Job Description (paste)"
                value={form.jdText}
                onChange={(e) => setField("jdText", e.target.value)}
                multiline
                minRows={10}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Stack Tags (comma separated)"
                value={form.tags}
                onChange={(e) => setField("tags", e.target.value)}
              />
              <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {tagList.map((t) => (
                  <Chip key={t} label={t} size="small" variant="outlined" />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} sx={{ display: "flex", gap: 1 }}>
              <Button type="submit" variant="contained">Save Job</Button>
              <Button variant="outlined" onClick={() => nav("/jobs")}>Cancel</Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
}
