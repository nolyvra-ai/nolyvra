import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, CircularProgress, Alert,
  Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import AddContactDialog from "./AddContactDialog";

const API     = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const loginId = () => localStorage.getItem("loginId") || "";
const hdrs    = () => ({ Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` });

const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#8A94A6";
const TEXT      = "#0F1623";
const ACCENT    = "#1D72E8";
const SUCCESS   = "#16A34A";
const SUCCESS_L = "rgba(22,163,74,0.08)";
const WARN      = "#D97706";
const WARN_L    = "rgba(217,119,6,0.08)";
const DANGER    = "#DC2626";

const CARD = { bgcolor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)" };
const FIELD_SX = {
  "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13, "& fieldset": { borderColor: BORDER } },
  "& .MuiInputLabel-root": { fontSize: 13 },
};
const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`, bgcolor: "#FAFBFD", py: 1.25, px: 2,
};

function Tag({ children, color = ACCENT, bg = "rgba(29,114,232,0.08)" }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", bgcolor: bg, color,
      border: `1px solid ${color}33`, borderRadius: "20px", px: "10px", py: "2px",
      fontSize: 11, fontWeight: 700,
    }}>{children}</Box>
  );
}

export default function ContactsListPage() {
  const nav = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [addOpen, setAddOpen]       = useState(false);

  useEffect(() => {
    setLoading(true); setError("");
    fetch(`${API}/api/contacts?loginId=${encodeURIComponent(loginId())}`, { headers: hdrs() })
      .then(r => { if (!r.ok) throw new Error(`Failed to load contacts (${r.status})`); return r.json(); })
      .then(data => setContacts(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemoveContact(e, contact) {
    e.stopPropagation();
    if (!window.confirm(`Remove ${contact.name} from contacts?`)) return;
    setRemovingId(contact.id);
    try {
      const r = await fetch(`${API}/api/contacts/${contact.id}?loginId=${encodeURIComponent(loginId())}`, {
        method: "DELETE", headers: hdrs(),
      });
      if (!r.ok) throw new Error(`Failed to remove contact (${r.status})`);
      setContacts(prev => prev.filter(c => c.id !== contact.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setRemovingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(c => {
      if (statusFilter && c.clientStatus !== statusFilter) return false;
      if (!q) return true;
      return [c.name, c.clientCompanyName, c.title, c.email]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q));
    });
  }, [contacts, search, statusFilter]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2.5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Client Contacts</Typography>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Every contact captured from clients and leads, in one place
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setAddOpen(true)}
          sx={{ borderRadius: "8px", textTransform: "none", bgcolor: ACCENT, px: 2.5, fontSize: 13, fontWeight: 600,
            boxShadow: "none", flexShrink: 0, "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
          + Add Contact
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <TextField size="small" placeholder="Search by name, company, job title or email…"
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ ...FIELD_SX, minWidth: 320 }} />
        <TextField select size="small" label="Status" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)} sx={{ ...FIELD_SX, minWidth: 140 }}>
          <MenuItem value="" sx={{ fontSize: 13 }}>All statuses</MenuItem>
          <MenuItem value="CLIENT" sx={{ fontSize: 13 }}>Client</MenuItem>
          <MenuItem value="LEAD" sx={{ fontSize: 13 }}>Lead</MenuItem>
        </TextField>
        {(search || statusFilter) && (
          <Box onClick={() => { setSearch(""); setStatusFilter(""); }}
            sx={{ display: "flex", alignItems: "center", fontSize: 12, color: MUTED, cursor: "pointer", "&:hover": { color: ACCENT } }}>
            Clear filters
          </Box>
        )}
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: ACCENT }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12, borderRadius: "8px" }}>{error}</Alert>
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
          <Typography sx={{ fontSize: 13, color: MUTED }}>
            {contacts.length === 0 ? "No client contacts yet." : "No contacts match the current filters."}
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Name</TableCell>
                <TableCell sx={thSx}>Job Title</TableCell>
                <TableCell sx={thSx}>Company</TableCell>
                <TableCell sx={thSx}>Email</TableCell>
                <TableCell sx={thSx}>Phone</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={thSx}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} onClick={() => nav(`/contacts/${c.id}`)}
                  sx={{ cursor: "pointer", "&:hover": { bgcolor: "#F8FAFC" }, "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12.5, fontWeight: 600, color: ACCENT, borderBottom: `1px solid ${BORDER}` }}>
                    {c.name}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {c.title || "—"}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {c.clientCompanyName || "—"}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {c.email || "—"}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {c.phone || "—"}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                    <Tag color={c.clientStatus === "CLIENT" ? SUCCESS : WARN} bg={c.clientStatus === "CLIENT" ? SUCCESS_L : WARN_L}>
                      {c.clientStatus === "CLIENT" ? "Client" : "Lead"}
                    </Tag>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                    <Box onClick={e => handleRemoveContact(e, c)}
                      sx={{ display: "inline-block", fontSize: 11.5, fontWeight: 600, color: DANGER, cursor: "pointer",
                        opacity: removingId === c.id ? 0.5 : 1, pointerEvents: removingId === c.id ? "none" : "auto",
                        "&:hover": { textDecoration: "underline" } }}>
                      {removingId === c.id ? "Removing…" : "Remove"}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <AddContactDialog open={addOpen} onClose={() => setAddOpen(false)}
        onSaved={saved => { setContacts(prev => [saved, ...prev]); nav(`/contacts/${saved.id}`); }} />
    </Box>
  );
}
