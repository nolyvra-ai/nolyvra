import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogContent,
  DialogTitle, FormControlLabel, Paper, Switch, TextField, Tooltip, Typography,
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

function htmlToPlainText(html) {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n");
  const documentBody = new DOMParser().parseFromString(withBreaks, "text/html").body;
  return (documentBody.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function VisualHtmlEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const [fontName, setFontName] = useState("Arial");
  const [fontSize, setFontSize] = useState("3");
  const [blockFormat, setBlockFormat] = useState("p");

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function format(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  }

  function selectFormat(command, commandValue, setter) {
    setter(commandValue);
    format(command, commandValue);
  }

  const toolButtonSx = {
    minWidth: 30,
    width: 30,
    height: 30,
    p: 0,
    color: TEXT,
    border: `1px solid ${BORDER}`,
    borderRadius: "5px",
    fontSize: 13,
    textTransform: "none",
  };

  return (
    <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
      <Box
        role="toolbar"
        aria-label="Email formatting"
        sx={{
          px: 1.25, py: 1, display: "flex", alignItems: "center", gap: 0.5,
          bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap",
        }}
      >
        <TextField
          select
          size="small"
          value={fontName}
          onChange={event => selectFormat("fontName", event.target.value, setFontName)}
          aria-label="Font family"
          SelectProps={{ native: true }}
          sx={{ width: 92, "& .MuiInputBase-root": { height: 30, fontSize: 12 } }}
        >
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Tahoma">Tahoma</option>
          <option value="Verdana">Verdana</option>
        </TextField>
        <TextField
          select
          size="small"
          value={fontSize}
          onChange={event => selectFormat("fontSize", event.target.value, setFontSize)}
          aria-label="Font size"
          SelectProps={{ native: true }}
          sx={{ width: 68, "& .MuiInputBase-root": { height: 30, fontSize: 12 } }}
        >
          <option value="2">12</option>
          <option value="3">14</option>
          <option value="4">18</option>
          <option value="5">24</option>
        </TextField>
        <Button
          size="small"
          aria-label="Bold"
          onMouseDown={event => event.preventDefault()}
          onClick={() => format("bold")}
          sx={{ ...toolButtonSx, fontWeight: 800 }}
        >
          B
        </Button>
        <Button
          size="small"
          aria-label="Italic"
          onMouseDown={event => event.preventDefault()}
          onClick={() => format("italic")}
          sx={{ ...toolButtonSx, fontStyle: "italic", fontFamily: "serif", fontWeight: 700 }}
        >
          I
        </Button>
        {[
          { label: "• List", title: "Bulleted list", command: "insertUnorderedList" },
          { label: "1. List", title: "Numbered list", command: "insertOrderedList" },
          { label: "Tx", title: "Clear formatting", command: "removeFormat" },
          { label: "≡", title: "Align left", command: "justifyLeft" },
          { label: "≣", title: "Align center", command: "justifyCenter" },
          { label: "≡", title: "Align right", command: "justifyRight" },
        ].map(tool => (
          <Tooltip key={tool.title} title={tool.title}>
          <Button
            size="small"
            aria-label={tool.title}
            onMouseDown={event => event.preventDefault()}
            onClick={() => format(tool.command)}
            sx={{
              ...toolButtonSx,
              width: tool.title.includes("list") ? 46 : 30,
              fontSize: tool.title.includes("list") ? 10 : 14,
              transform: tool.title === "Align right" ? "scaleX(-1)" : "none",
            }}
          >
            {tool.label}
          </Button>
          </Tooltip>
        ))}
        <TextField
          select
          size="small"
          value={blockFormat}
          onChange={event => selectFormat("formatBlock", event.target.value, setBlockFormat)}
          aria-label="Text style"
          SelectProps={{ native: true }}
          sx={{ width: 130, ml: 0.5, "& .MuiInputBase-root": { height: 30, fontSize: 12 } }}
        >
          <option value="p">Normal text</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </TextField>
      </Box>
      <Box
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Email body editor"
        aria-multiline="true"
        onInput={event => onChange(event.currentTarget.innerHTML)}
        sx={{
          minHeight: 300,
          p: 2.5,
          bgcolor: "#fff",
          color: "#111827",
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          outline: "none",
          overflowY: "auto",
          "&:focus": { boxShadow: `inset 0 0 0 2px ${ACCENT}` },
          "& img": { maxWidth: "100%", height: "auto" },
        }}
      />
    </Box>
  );
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
  const [showHtml, setShowHtml] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [autoPlainText, setAutoPlainText] = useState(true);
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
      setShowHtml(false);
      setAdvancedOpen(false);
      setAutoPlainText(true);
      setError("");
      setSuccess("");
    } else if (!selected && !loading && templates.length) {
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

  function updateHtml(value) {
    setDraft(current => ({
      ...current,
      htmlBody: value,
      textBody: autoPlainText ? htmlToPlainText(value) : current.textBody,
    }));
    setError("");
    setSuccess("");
  }

  function regeneratePlainText() {
    setDraft(current => ({ ...current, textBody: htmlToPlainText(current.htmlBody) }));
    setAutoPlainText(true);
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
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                    Email body
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={showHtml}
                          onChange={event => setShowHtml(event.target.checked)}
                        />
                      }
                      label="Show HTML code"
                      sx={{ mr: 0, "& .MuiFormControlLabel-label": { fontSize: 12, color: TEXT } }}
                    />
                    <Tooltip title="Edit the HTML source used to render this email.">
                      <Box component="span" aria-label="HTML code information"
                        sx={{ ml: 0.25, color: TEXT, fontSize: 13, cursor: "help" }}>
                        ⓘ
                      </Box>
                    </Tooltip>
                  </Box>
                </Box>
                {showHtml ? (
                  <TextField
                    label="HTML body"
                    fullWidth
                    multiline
                    minRows={12}
                    value={draft.htmlBody}
                    onChange={event => updateHtml(event.target.value)}
                    inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }}
                  />
                ) : (
                  <VisualHtmlEditor value={draft.htmlBody} onChange={updateHtml} />
                )}
              </Box>
              <Box>
                <Button
                  size="small"
                  onClick={() => setAdvancedOpen(current => !current)}
                  aria-expanded={advancedOpen}
                  sx={{ px: 0, fontSize: 11.5, textTransform: "none" }}
                >
                  {advancedOpen ? "Hide advanced options" : "Advanced options"}
                </Button>
                {advancedOpen && (
                  <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: 10.5, color: MUTED }}>
                        Plain-text fallback · {autoPlainText ? "Automatically generated from HTML" : "Manually edited"}
                      </Typography>
                      <Button size="small" onClick={regeneratePlainText}
                        sx={{ fontSize: 10.5, textTransform: "none" }}>
                        Regenerate from HTML
                      </Button>
                    </Box>
                    <TextField
                      label="Plain-text body"
                      multiline
                      minRows={5}
                      value={draft.textBody}
                      onChange={event => {
                        setAutoPlainText(false);
                        update("textBody", event.target.value);
                      }}
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Switch checked={draft.enabled} onChange={event => update("enabled", event.target.checked)} />
                <Typography sx={{ fontSize: 12 }}>Enabled</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <Button color="warning" onClick={restore} disabled={saving || !draft.customized}>Restore default</Button>
                <Button variant="contained" onClick={save} disabled={saving || !dirty}>
                  {saving ? <CircularProgress size={16} /> : "Save"}
                </Button>
              </Box>
            </Box>
          </DialogContent>
        </>}
      </Dialog>

    </Paper>
  );
}
