import { useState } from "react";
import { Box, Dialog, IconButton, Typography, TextField, Button } from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const ACCENT = "#1D72E8";
const TEXT = "#0F1623";
const MUTED = "#5A6480";
const BORDER = "#E2E6ED";

export default function ServiceRequestModal({ open, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setComments("");
    setError("");
    setSent(false);
  }

  function handleClose() {
    if (submitting) return;
    onClose();
    reset();
  }

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !comments.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const loginId = localStorage.getItem("loginId") || "";
      const url = new URL(`${API_BASE}/api/emails/service-request`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), comments: comments.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSent(true);
    } catch {
      setError("Something went wrong sending your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <Box sx={{ position: "relative", p: 3.5 }}>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Close"
          sx={{
            position: "absolute", top: 12, right: 12,
            bgcolor: "#F7F8FA", border: `1px solid ${BORDER}`, zIndex: 1,
            "&:hover": { bgcolor: "#F0F2F6" },
          }}
        >
          ✕
        </IconButton>

        {sent ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <Typography variant="h6" sx={{ color: TEXT, fontWeight: 800, mb: 1 }}>
              Request sent
            </Typography>
            <Typography sx={{ fontSize: 14, color: MUTED, mb: 3 }}>
              Thanks — our team will get back to you shortly.
            </Typography>
            <Button
              onClick={handleClose}
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660c9", boxShadow: "none" } }}
            >
              Close
            </Button>
          </Box>
        ) : (
          <>
            <Typography variant="h6" sx={{ color: TEXT, fontWeight: 800, mb: 0.5 }}>
              Raise a service request
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: MUTED, mb: 2.5 }}>
              Tell us what you need help with and our team will follow up by email.
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
                disabled={submitting}
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                size="small"
                disabled={submitting}
              />
              <TextField
                label="Comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                fullWidth
                multiline
                minRows={4}
                disabled={submitting}
              />
              {error && (
                <Typography sx={{ fontSize: 12.5, color: "#DC2626" }}>{error}</Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 3 }}>
              <Button onClick={handleClose} disabled={submitting} sx={{ textTransform: "none", color: MUTED, fontWeight: 600 }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                variant="contained"
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", px: 3, bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660c9", boxShadow: "none" } }}
              >
                {submitting ? "Sending…" : "Submit"}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
}
