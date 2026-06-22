import { useState, useRef, useEffect } from "react";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Select, FormControl, InputLabel, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS_BG = "#F0FDF4", SURFACE = "#FAFBFD";

const TARGET_FIELDS = [
  { key: "first_name",      label: "First Name",      required: true  },
  { key: "last_name",       label: "Last Name",       required: false },
  { key: "email",           label: "Email",           required: false },
  { key: "phone_number",    label: "Phone Number",    required: false },
  { key: "linkedin_url",    label: "LinkedIn URL",    required: false },
  { key: "current_title",   label: "Job Title",       required: false },
  { key: "current_company", label: "Employer",        required: false },
  { key: "location",        label: "Location",        required: false },
];

const NONE = "__none__";

// onJobStarted(jobId, totalRows) — called when user closes dialog mid-import so parent can poll
export default function ImportCandidatesDialog({ open, onClose, onImported, onJobStarted }) {
  const loginId  = localStorage.getItem("loginId") || "";
  const fileRef  = useRef(null);
  const pollRef  = useRef(null);

  const [screen,   setScreen]   = useState("upload"); // upload | mapping | importing | result
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [mapping,  setMapping]  = useState({});
  const [jobId,    setJobId]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [dragging, setDragging] = useState(false);

  // Poll while dialog is open and import is running
  useEffect(() => {
    if (!jobId || screen !== "importing") return;

    async function poll() {
      try {
        const url = new URL(`${API_BASE}/api/candidates/import/status/${jobId}`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "DONE") {
          clearInterval(pollRef.current);
          setResult({
            importedCount:  data.importedCount  ?? 0,
            updatedCount:   data.updatedCount   ?? 0,
            duplicateCount: data.duplicateCount ?? 0,
            invalidCount:   data.invalidCount   ?? 0,
            totalRows:      data.totalRows      ?? 0,
          });
          setScreen("result");
          if (onImported) onImported();
        } else if (data.status === "ERROR") {
          clearInterval(pollRef.current);
          setError(data.error || "Import failed — please try again");
          setScreen("mapping");
        }
      } catch (_) {
        // transient network error — keep polling
      }
    }

    poll(); // immediate first check
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
  }, [jobId, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    clearInterval(pollRef.current);
    setScreen("upload"); setLoading(false); setError(null);
    setPreview(null); setMapping({}); setJobId(null); setResult(null); setDragging(false);
  }

  function handleClose() { reset(); onClose(); }

  // Close mid-import — hand job off to parent so it can surface the completion popup
  function handleCloseAndContinue() {
    clearInterval(pollRef.current);
    if (onJobStarted && jobId) onJobStarted(jobId, preview?.totalRows ?? 0);
    reset();
    onClose();
  }

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = new URL(`${API_BASE}/api/candidates/import/preview`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: fd,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = txt; try { msg = JSON.parse(txt).message || txt; } catch {}
        throw new Error(msg || "Failed to read file");
      }
      const data = await res.json();
      setPreview(data);
      const init = {};
      TARGET_FIELDS.forEach(f => { init[f.key] = data.suggestedMapping?.[f.key] || NONE; });
      setMapping(init);
      setScreen("mapping");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setError(null);
    setLoading(true);
    try {
      const finalMapping = {};
      TARGET_FIELDS.forEach(f => {
        const v = mapping[f.key];
        if (v && v !== NONE) finalMapping[f.key] = v;
      });
      const url = new URL(`${API_BASE}/api/candidates/import/confirm-async`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({ importToken: preview.importToken, mapping: finalMapping }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = txt; try { msg = JSON.parse(txt).message || txt; } catch {}
        throw new Error(msg || "Could not start import");
      }
      const { jobId: newJobId } = await res.json();
      setJobId(newJobId);
      setScreen("importing");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    if (result?.importedCount > 0 && onImported) onImported();
    handleClose();
  }

  const canImport = mapping["first_name"] && mapping["first_name"] !== NONE;

  const titles = {
    upload:    "Upload Candidates",
    mapping:   "Map your columns",
    importing: "Importing…",
    result:    "Import Complete",
  };

  return (
    <Dialog open={open} onClose={() => !loading && screen !== "importing" && handleClose()}
      maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>

      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 2, px: 3, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{titles[screen]}</Typography>
        {screen !== "importing" && (
          <IconButton size="small" onClick={handleClose} disabled={loading}
            sx={{ color: MUTED, "&:hover": { bgcolor: "#F1F3F7" } }}>✕</IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 3, minHeight: 300 }}>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: "8px", fontSize: 12 }}>
            {error}
          </Alert>
        )}

        {/* ── Screen 1: Upload ── */}
        {screen === "upload" && (
          <Box>
            <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 2.5, lineHeight: 1.65 }}>
              Upload a spreadsheet exported from your ATS or CRM. AI detects column names automatically — you can review and adjust before importing.
            </Typography>
            <Box
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
              onClick={() => !loading && fileRef.current?.click()}
              sx={{
                border: `2px dashed ${dragging ? ACCENT : BORDER}`,
                borderRadius: "12px", p: "52px 24px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
                bgcolor: dragging ? "#EBF2FF" : SURFACE,
                cursor: loading ? "default" : "pointer", transition: "all .15s",
                "&:hover": loading ? {} : { borderColor: ACCENT, bgcolor: "#EBF2FF" },
              }}>
              {loading ? (
                <>
                  <CircularProgress size={28} sx={{ color: ACCENT }} />
                  <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>Reading file and detecting columns…</Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: 32 }}>📊</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: TEXT }}>Drop your spreadsheet here or click to browse</Typography>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>Supports .xlsx · .xls · .csv</Typography>
                </>
              )}
            </Box>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
              onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
          </Box>
        )}

        {/* ── Screen 2: Mapping & Preview ── */}
        {screen === "mapping" && preview && (
          <Box>
            <Typography sx={{ fontSize: 12, color: MUTED, mb: 2.5 }}>
              {preview.totalRows} row{preview.totalRows !== 1 ? "s" : ""} detected. Match each field to the correct column, then click Import.
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.75, mb: 3 }}>
              {TARGET_FIELDS.map(f => (
                <FormControl key={f.key} size="small" fullWidth>
                  <InputLabel sx={{ fontSize: 12.5 }}>{f.label}{f.required ? " *" : ""}</InputLabel>
                  <Select
                    value={mapping[f.key] || NONE}
                    label={`${f.label}${f.required ? " *" : ""}`}
                    onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                    sx={{ fontSize: 12.5, borderRadius: "8px" }}>
                    <MenuItem value={NONE} sx={{ fontSize: 12.5, color: MUTED }}>— Not in file —</MenuItem>
                    {preview.rawHeaders.map(h => (
                      <MenuItem key={h} value={h} sx={{ fontSize: 12.5 }}>{h}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
            {preview.previewRows.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, mb: 1 }}>
                  Preview (first {preview.previewRows.length} row{preview.previewRows.length !== 1 ? "s" : ""})
                </Typography>
                <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#FAFBFD" }}>
                        {TARGET_FIELDS.map(f => (
                          <TableCell key={f.key} sx={{ fontSize: 11, fontWeight: 600, color: MUTED, py: 1, borderBottom: `1px solid ${BORDER}` }}>
                            {f.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.previewRows.map((row, ri) => (
                        <TableRow key={ri} sx={{ "&:hover": { bgcolor: "#FAFBFD" } }}>
                          {TARGET_FIELDS.map(f => {
                            const hdr = mapping[f.key];
                            const val = hdr && hdr !== NONE ? row[hdr] : null;
                            return (
                              <TableCell key={f.key} sx={{ fontSize: 12, color: val ? TEXT : "#C2C8D4", py: 0.9, borderBottom: `1px solid ${BORDER}` }}>
                                {val || "—"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ── Screen 3: Importing (async in progress) ── */}
        {screen === "importing" && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 2.5 }}>
            <CircularProgress size={40} sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
              Importing {preview?.totalRows ?? ""} candidate{(preview?.totalRows ?? 0) !== 1 ? "s" : ""}…
            </Typography>
            <Box sx={{
              bgcolor: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: "10px",
              p: "14px 20px", maxWidth: 400, textAlign: "center",
            }}>
              <Typography sx={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.75 }}>
                You can close this dialog and keep working.<br />
                We'll show you a notification as soon as the import is complete.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── Screen 4: Result ── */}
        {screen === "result" && result && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 2 }}>
            <Box sx={{ width: 60, height: 60, borderRadius: "50%", bgcolor: SUCCESS_BG, border: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
              ✅
            </Box>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: TEXT, textAlign: "center" }}>
              {result.importedCount} candidate{result.importedCount !== 1 ? "s" : ""} imported successfully
            </Typography>
            {(result.updatedCount > 0 || result.duplicateCount > 0 || result.invalidCount > 0) && (
              <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", lineHeight: 1.7 }}>
                {result.updatedCount > 0 && `${result.updatedCount} existing candidate${result.updatedCount !== 1 ? "s" : ""} updated`}
                {result.updatedCount > 0 && (result.duplicateCount > 0 || result.invalidCount > 0) && " · "}
                {result.duplicateCount > 0 && `${result.duplicateCount} duplicate${result.duplicateCount !== 1 ? "s" : ""} skipped`}
                {result.duplicateCount > 0 && result.invalidCount > 0 && " · "}
                {result.invalidCount > 0 && `${result.invalidCount} row${result.invalidCount !== 1 ? "s" : ""} skipped (missing name or contact info)`}
              </Typography>
            )}
          </Box>
        )}

      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
        {(screen === "upload" || screen === "mapping") && (
          <Button variant="outlined" size="small" onClick={handleClose} disabled={loading}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Cancel
          </Button>
        )}
        {screen === "mapping" && (
          <Button variant="contained" size="small" onClick={handleImport} disabled={!canImport || loading}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {loading
              ? <CircularProgress size={14} sx={{ color: "#fff" }} />
              : `Import ${preview?.totalRows ?? ""} Candidate${(preview?.totalRows ?? 0) !== 1 ? "s" : ""}`}
          </Button>
        )}
        {screen === "importing" && (
          <Button variant="outlined" size="small" onClick={handleCloseAndContinue}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Close and continue working
          </Button>
        )}
        {screen === "result" && (
          <Button variant="contained" size="small" onClick={handleDone}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
