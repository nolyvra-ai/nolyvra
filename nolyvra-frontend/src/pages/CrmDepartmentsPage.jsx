import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress,
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#8A94A6";
const TEXT      = "#0F1623";
const PURPLE    = "#7C3AED";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";

const CARD_BASE = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)", overflow: "hidden",
};

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: "#FAFBFD", py: 1.25, px: 2.5, whiteSpace: "nowrap",
};

export default function CrmDepartmentsPage() {
  const loginId = localStorage.getItem("loginId") || "";

  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const [addOpen,    setAddOpen]    = useState(false);
  const [name,       setName]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm/departments?loginId=${loginId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setDepartments(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm/departments?loginId=${loginId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || res.status);
      }
      setAddOpen(false);
      setName("");
      load();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Departments</Typography>
            <Box sx={{
              fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
              border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
            }}>BETA</Box>
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Organise your team by department
          </Typography>
        </Box>
        <Button
          onClick={() => { setName(""); setSaveError(null); setAddOpen(true); }}
          variant="contained"
          size="small"
          sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
            boxShadow: "none",
            "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
          }}
        >
          + Add Department
        </Button>
      </Box>

      {/* Table */}
      <Paper elevation={0} sx={{ ...CARD_BASE }}>
        {loading ? (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} sx={{ color: PURPLE }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, fontSize: 12 }}>{error}</Alert>
        ) : departments.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED }}>
              No departments yet. Add one to get started.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Department Name</TableCell>
                <TableCell sx={thSx}>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departments.map(dept => (
                <TableRow key={dept.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.5, px: 2.5, fontSize: 13, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {dept.name}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2.5, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {dept.createdAt ? new Date(dept.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    }) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add Department Dialog */}
      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "14px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 0.5 }}>
          Add Department
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          {saveError && (
            <Alert severity="error" sx={{ mb: 1.5, fontSize: 12 }}>
              {saveError.includes("409") || saveError.toLowerCase().includes("already exists")
                ? `A department named "${name}" already exists.`
                : saveError}
            </Alert>
          )}
          <TextField
            label="Department name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !saving && handleSave()}
            fullWidth
            autoFocus
            size="small"
            InputProps={{ sx: { fontSize: 13 } }}
            InputLabelProps={{ sx: { fontSize: 13 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving}
            sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} variant="contained" sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "none",
            "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
          }}>
            {saving ? "Saving…" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
