import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent,
  DialogTitle, Paper, Switch, TextField, Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2";
const MUTED = "#7A8496";
const TEXT = "#0F1623";
const ACCENT = "#1D72E8";

function authHeaders(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
  };
}

function validate(template) {
  if (!template.subject.trim()) return "Subject is required.";
  if (!template.htmlBody.trim()) return "HTML body is required.";
  if (!template.textBody.trim()) return "Plain-text body is required.";
  const combined = `${template.subject}\n${template.htmlBody}\n${template.textBody}`;
  const missing = template.requiredVariables.find(variable => !combined.includes(`{{${variable}}}`));
  return missing ? `Required variable is missing: ${missing}` : "";
}

export default function SystemEmailTemplatesPanel({ selectedKey, onDirtyChange }) {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const [templates, setTemplates] = useState([]);
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resendConfigured, setResendConfigured] = useState(null);

  const dirty = useMemo(
    () => draft && original && JSON.stringify(draft) !== JSON.stringify(original),
    [draft, original]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/auth/admin/system-email-templates?loginId=${encodeURIComponent(loginId)}`,
        { headers: authHeaders() }),
      fetch(`${API_BASE}/api/auth/admin/system-email-templates/status?loginId=${encodeURIComponent(loginId)}`,
        { headers: authHeaders() }),
    ])
      .then(async ([templatesResponse, statusResponse]) => {
        if (!templatesResponse.ok) throw new Error((await templatesResponse.json()).error || "Could not load templates.");
        const loaded = await templatesResponse.json();
        const status = statusResponse.ok ? await statusResponse.json() : {};
        if (!cancelled) {
          setTemplates(loaded);
          setResendConfigured(Boolean(status.resendConfigured));
        }
      })
      .catch(fetchError => { if (!cancelled) setError(fetchError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loginId]);

  useEffect(() => {
    if (!selectedKey) {
      setDraft(null);
      setOriginal(null);
      return;
    }
    const selected = templates.find(template => template.key === selectedKey);
    if (selected && draft?.key !== selectedKey) {
      setDraft({ ...selected });
      setOriginal({ ...selected });
      setError("");
      setSuccess("");
    } else if (!loading && templates.length) {
      nav("/settings/email", { replace: true });
    }
  }, [selectedKey, templates, loading, nav, draft?.key]);

  useEffect(() => {
    const warn = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    onDirtyChange?.(Boolean(dirty));
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  function openTemplate(key) {
    if (dirty && !window.confirm("Discard unsaved template changes?")) return;
    nav(`/settings/email/${key}`);
  }

  function closeEditor() {
    if (dirty && !window.confirm("Discard unsaved template changes?")) return;
    nav("/settings/email");
  }

  function update(field, value) {
    setDraft(current => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  }

  async function save() {
    const validation = validate(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/auth/admin/system-email-templates/${draft.key}?loginId=${encodeURIComponent(loginId)}`,
        {
          method: "PUT",
          headers: authHeaders(true),
          body: JSON.stringify({
            subject: draft.subject,
            htmlBody: draft.htmlBody,
            textBody: draft.textBody,
            enabled: draft.enabled,
            version: draft.version,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save template.");
      setTemplates(items => items.map(item => item.key === data.key ? data : item));
      setDraft({ ...data });
      setOriginal({ ...data });
      setSuccess("Template saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!window.confirm("Restore this template to its built-in default?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/auth/admin/system-email-templates/${draft.key}`
          + `?loginId=${encodeURIComponent(loginId)}&version=${draft.version}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not restore template.");
      setTemplates(items => items.map(item => item.key === data.key ? data : item));
      setDraft({ ...data });
      setOriginal({ ...data });
      setSuccess("Default restored.");
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>System Email Templates</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Approved wording and branding for transactional emails
          </Typography>
        </Box>
        <Chip
          size="small"
          label={`Resend: ${resendConfigured === null ? "Checking…" : resendConfigured ? "Configured" : "Not configured"}`}
          color={resendConfigured ? "success" : "default"}
          sx={{ fontSize: 10.5 }}
        />
      </Box>

      {error && !draft && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ p: 4, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>
      ) : (
        <Box sx={{ p: 1.5, display: "grid", gap: 1 }}>
          {templates.map(template => (
            <Button
              key={template.key}
              onClick={() => openTemplate(template.key)}
              sx={{
                p: 1.5, border: `1px solid ${BORDER}`, borderRadius: "8px",
                textAlign: "left", textTransform: "none", justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{template.name}</Typography>
                <Typography sx={{ fontSize: 10.5, color: MUTED }}>{template.subject}</Typography>
              </Box>
              <Chip size="small" label={template.customized ? "Custom" : "Default"} sx={{ fontSize: 10 }} />
            </Button>
          ))}
        </Box>
      )}

      <Dialog open={Boolean(draft)} onClose={closeEditor} fullWidth maxWidth="md">
        {draft && <>
          <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>
            {draft.name}
            {dirty && <Typography component="span" sx={{ ml: 1, fontSize: 11, color: "#D97706" }}>Unsaved changes</Typography>}
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">{success}</Alert>}
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.75 }}>Supported variables</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {draft.supportedVariables.map(variable => (
                    <Chip key={variable} size="small"
                      label={`{{${variable}}}${draft.requiredVariables.includes(variable) ? " *" : ""}`}
                      sx={{ fontFamily: "monospace", fontSize: 10.5 }} />
                  ))}
                </Box>
              </Box>
              <TextField label="Subject" value={draft.subject} onChange={event => update("subject", event.target.value)} />
              <TextField label="HTML body" multiline minRows={8} value={draft.htmlBody}
                onChange={event => update("htmlBody", event.target.value)} />
              <TextField label="Plain-text body" multiline minRows={5} value={draft.textBody}
                onChange={event => update("textBody", event.target.value)} />
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Switch checked={draft.enabled} onChange={event => update("enabled", event.target.checked)} />
                <Typography sx={{ fontSize: 12 }}>Enabled</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <Button onClick={() => setPreviewOpen(true)} disabled={!draft.htmlBody.trim()}>Preview</Button>
                <Button color="warning" onClick={restore} disabled={saving || !draft.customized}>Restore default</Button>
                <Button variant="contained" onClick={save} disabled={saving || !dirty}>
                  {saving ? <CircularProgress size={16} /> : "Save"}
                </Button>
              </Box>
            </Box>
          </DialogContent>
        </>}
      </Dialog>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>Template Preview</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box component="iframe" title="System email template preview" sandbox="" srcDoc={draft?.htmlBody || ""}
            sx={{ width: "100%", minHeight: 480, border: 0, display: "block" }} />
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
