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

const INDUSTRIES = [
  "FinTech", "HealthTech", "CleanTech", "E-Commerce", "SaaS", "EdTech",
  "PropTech", "InsurTech", "Retail", "Manufacturing", "Logistics", "Consulting", "Other",
];

const SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

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
  companyName: "", industry: "", companySize: "", location: "",
  contactPerson: "", contactEmail: "", contactTitle: "", linkedinUrl: "", notes: "",
};

function toForm(data) {
  if (!data) return { ...empty };
  return {
    companyName:   data.companyName   || "",
    industry:      data.industry      || "",
    companySize:   data.companySize   || "",
    location:      data.location      || "",
    contactPerson: data.contactPerson || "",
    contactEmail:  data.contactEmail  || "",
    contactTitle:  data.contactTitle  || "",
    linkedinUrl:   data.linkedinUrl   || "",
    notes:         data.notes         || "",
  };
}

export default function AddClientDialog({ open, onClose, onSaved, initialData = null, clientId = null }) {
  const loginId = localStorage.getItem("loginId") || "";
  const isEdit  = clientId != null;

  const [form, setForm]     = useState(() => toForm(initialData));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // Re-populate form each time the dialog opens
  useEffect(() => {
    if (open) {
      setForm(toForm(initialData));
      setError("");
    }
  }, [open]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function handleClose() {
    setForm({ ...empty });
    setError("");
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.companyName.trim()) { setError("Company Name is required."); return; }

    setSaving(true);
    setError("");
    try {
      const url = isEdit
        ? `${API}/api/clients/${clientId}?loginId=${encodeURIComponent(loginId)}`
        : `${API}/api/clients?loginId=${encodeURIComponent(loginId)}`;
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: hdrs(),
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const saved = await r.json();
      setForm({ ...empty });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px", boxShadow: "0 8px 40px rgba(15,22,35,0.18)" } }}>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 16, color: "#0F1623", pb: 0, pt: "20px", px: "24px" }}>
        {isEdit ? "Edit Client" : "Add New Client"}
        <Box sx={{ fontSize: 12, color: "#8A94A6", fontWeight: 400, mt: "2px" }}>
          Only Company Name is required
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ px: "24px", pt: "16px", pb: "8px" }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px", fontSize: 12 }}>{error}</Alert>}

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <TextField label="Company Name *" value={form.companyName} onChange={set("companyName")}
              fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small" />

            <TextField select label="Industry" value={form.industry} onChange={set("industry")}
              fullWidth sx={FIELD_SX} size="small">
              <MenuItem value=""><em>Select…</em></MenuItem>
              {INDUSTRIES.map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </TextField>

            <TextField select label="Company Size" value={form.companySize} onChange={set("companySize")}
              fullWidth sx={FIELD_SX} size="small">
              <MenuItem value=""><em>Select…</em></MenuItem>
              {SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>

            <TextField label="Location" value={form.location} onChange={set("location")}
              fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small"
              placeholder="e.g. London, UK" />

            <TextField label="Contact Person" value={form.contactPerson} onChange={set("contactPerson")}
              fullWidth sx={FIELD_SX} size="small" />

            <TextField label="Contact Title" value={form.contactTitle} onChange={set("contactTitle")}
              fullWidth sx={FIELD_SX} size="small" placeholder="e.g. Head of Talent" />

            <TextField label="Contact Email" value={form.contactEmail} onChange={set("contactEmail")}
              type="email" fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small" />

            <TextField label="LinkedIn URL" value={form.linkedinUrl} onChange={set("linkedinUrl")}
              fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small"
              placeholder="https://linkedin.com/company/…" />

            <TextField label="Notes" value={form.notes} onChange={set("notes")}
              fullWidth multiline rows={3} sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} size="small"
              placeholder="Relationship history, preferences, context…" />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: "24px", pb: "20px", pt: "12px", gap: "8px" }}>
          <Button onClick={handleClose} disabled={saving}
            sx={{ borderRadius: "8px", textTransform: "none", color: "#8A94A6",
              border: "1px solid #E8ECF2", px: 2.5, fontSize: 13,
              "&:hover": { bgcolor: "#F8FAFC", borderColor: "#C8D0DC" } }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}
            sx={{ borderRadius: "8px", textTransform: "none", bgcolor: "#1D72E8",
              px: 3, fontSize: 13, fontWeight: 600, boxShadow: "none",
              "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
            {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : isEdit ? "Save Changes" : "Add Client"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
