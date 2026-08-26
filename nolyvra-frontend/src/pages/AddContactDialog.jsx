import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, TextField, MenuItem, Button, CircularProgress, Alert
} from "@mui/material";

const API  = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
});

const FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    fontSize: 13,
    "& fieldset": { borderColor: "#E8ECF2" },
    "&:hover fieldset": { borderColor: "#1D72E8" },
    "&.Mui-focused fieldset": { borderColor: "#1D72E8" },
  },
  "& .MuiInputLabel-root": { fontSize: 13 },
};

const empty = {
  clientId: "", name: "", title: "", email: "", phone: "", linkedinUrl: "", facebookUrl: "", twitterUrl: "",
  personalEmail: "", workEmail: "", otherEmail: "",
  personalPhone: "", workPhone: "", mobilePhone: "",
  meetupUrl: "", githubUrl: "", instagramUrl: "",
};

export default function AddContactDialog({ open, onClose, onSaved }) {
  const loginId = localStorage.getItem("loginId") || "";

  const [clients, setClients] = useState([]);
  const [form, setForm]       = useState(empty);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(empty);
    setError("");
    fetch(`${API}/api/clients?loginId=${encodeURIComponent(loginId)}`, { headers: hdrs() })
      .then(r => r.json())
      .then(data => setClients(data || []))
      .catch(() => setClients([]));
  }, [open]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientId) { setError("Client is required."); return; }
    if (!form.name.trim()) { setError("Name is required."); return; }

    setSaving(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/contacts?loginId=${encodeURIComponent(loginId)}`, {
        method: "POST",
        headers: hdrs(),
        body: JSON.stringify({ ...form, clientId: Number(form.clientId) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const saved = await r.json();
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px", boxShadow: "0 8px 40px rgba(15,22,35,0.18)" } }}>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 16, color: "#0F1623", pb: 0, pt: "20px", px: "24px" }}>
        Add New Contact
        <Box sx={{ fontSize: 12, color: "#8A94A6", fontWeight: 400, mt: "2px" }}>
          Client and Name are required — more detail can be added afterward
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ px: "24px", pt: "16px", pb: "8px" }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px", fontSize: 12 }}>{error}</Alert>}

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <TextField select label="Client *" value={form.clientId} onChange={set("clientId")}
              fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small">
              <MenuItem value=""><em>Select a client…</em></MenuItem>
              {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.companyName}</MenuItem>)}
            </TextField>

            <TextField label="Name *" value={form.name} onChange={set("name")}
              fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small" />

            <TextField label="Title" value={form.title} onChange={set("title")}
              fullWidth sx={FIELD_SX} size="small" placeholder="e.g. Head of Talent" />

            <TextField label="Email" value={form.email} onChange={set("email")}
              type="email" fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Phone" value={form.phone} onChange={set("phone")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="LinkedIn URL" value={form.linkedinUrl} onChange={set("linkedinUrl")}
              fullWidth sx={FIELD_SX} size="small" placeholder="https://linkedin.com/in/…" />

            <TextField label="Facebook URL" value={form.facebookUrl} onChange={set("facebookUrl")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Twitter / X URL" value={form.twitterUrl} onChange={set("twitterUrl")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Personal Email" value={form.personalEmail} onChange={set("personalEmail")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Work Email" value={form.workEmail} onChange={set("workEmail")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Other Email" value={form.otherEmail} onChange={set("otherEmail")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Personal Phone" value={form.personalPhone} onChange={set("personalPhone")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Work Phone" value={form.workPhone} onChange={set("workPhone")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Mobile Phone" value={form.mobilePhone} onChange={set("mobilePhone")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="MeetUp URL" value={form.meetupUrl} onChange={set("meetupUrl")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="GitHub URL" value={form.githubUrl} onChange={set("githubUrl")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Instagram URL" value={form.instagramUrl} onChange={set("instagramUrl")}
              fullWidth sx={FIELD_SX} size="small" />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: "24px", pb: "20px", pt: "12px", gap: "8px" }}>
          <Button onClick={onClose} disabled={saving}
            sx={{ borderRadius: "8px", textTransform: "none", color: "#8A94A6",
              border: "1px solid #E8ECF2", px: 2.5, fontSize: 13,
              "&:hover": { bgcolor: "#F8FAFC", borderColor: "#C8D0DC" } }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}
            sx={{ borderRadius: "8px", textTransform: "none", bgcolor: "#1D72E8",
              px: 3, fontSize: 13, fontWeight: 600, boxShadow: "none",
              "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
            {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Add Contact"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
