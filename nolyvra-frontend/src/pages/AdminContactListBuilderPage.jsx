import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import {
  buildContactLists,
  CONTACT_CATEGORIES,
  contactsToCsv,
  refreshContactQuality,
} from "../utils/contactListBuilder";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2";
const MUTED = "#6B7280";
const TEXT = "#0F1623";
const ACCENT = "#1D72E8";
const SURFACE = "#FAFBFD";
const ALL_OWNERS = "__all_owners__";
const TABLE_COLUMNS = [
  ["company", "Company"],
  ["name", "Contact Name"],
  ["phone", "Contact Number"],
  ["email", "Contact Email"],
  ["role", "Role"],
  ["segment", "Segment"],
  ["source", "Source"],
  ["owner", "Owner"],
  ["stage", "Stage"],
  ["dateAdded", "Date Added"],
  ["lastContact", "Last Contact"],
  ["nextActionDate", "Next Action Date"],
  ["nextStep", "Next Step"],
  ["packageName", "Package"],
  ["potentialMrr", "Potential MRR ($)"],
  ["notes", "Notes"],
  ["category", "Category"],
];
const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const CATEGORY_STYLES = {
  "Interested prospects": { color: "#1D4ED8", background: "#EFF6FF" },
  "Current users": { color: "#15803D", background: "#F0FDF4" },
  Followers: { color: "#7C3AED", background: "#F5F3FF" },
  "Needs review": { color: "#B45309", background: "#FFFBEB" },
};

function downloadCsv(filename, contents) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function authHeaders(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
  };
}

async function responseError(response, fallback) {
  try {
    const body = await response.json();
    return body.error || body.message || fallback;
  } catch {
    return fallback;
  }
}

export default function AdminContactListBuilderPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const loginId = localStorage.getItem("loginId") || "";
  const cannotBeAdmin = localStorage.getItem("authType") === "EMPLOYEE" || !loginId;

  const [adminStatus, setAdminStatus] = useState(cannotBeAdmin ? "denied" : "loading");
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Interested prospects");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editingContactId, setEditingContactId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [persistenceStatus, setPersistenceStatus] = useState("idle");
  const [importing, setImporting] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(ALL_OWNERS);
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    if (!tableFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const exitOnEscape = event => {
      if (event.key === "Escape") setTableFullscreen(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", exitOnEscape);
    };
  }, [tableFullscreen]);

  useEffect(() => {
    if (cannotBeAdmin) return;
    let active = true;

    async function loadWorkspace() {
      try {
        const accessResponse = await fetch(`${API_BASE}/api/auth/admin/access`, {
          headers: authHeaders(),
        });
        if (!active) return;
        if (!accessResponse.ok) {
          setAdminStatus("denied");
          return;
        }

        const workspaceResponse = await fetch(`${API_BASE}/api/auth/admin/contact-list`, {
          headers: authHeaders(),
        });
        if (!workspaceResponse.ok) {
          throw new Error(await responseError(workspaceResponse, "Could not load the saved contact list."));
        }
        const workspace = await workspaceResponse.json();
        if (!active) return;
        const savedContacts = refreshContactQuality(workspace.contacts || []);
        setContacts(savedContacts);
        setFileName(workspace.fileName || "");
        setHeaderRow(workspace.headerRow ?? null);
        const firstPopulated = CONTACT_CATEGORIES.find(category =>
          savedContacts.some(contact => contact.category === category),
        );
        setSelectedCategory(firstPopulated || "Interested prospects");
        setPersistenceStatus(savedContacts.length > 0 ? "saved" : "idle");
        setAdminStatus("allowed");
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Could not load the saved contact list.");
        setAdminStatus("error");
      }
    }

    loadWorkspace();
    return () => { active = false; };
  }, [cannotBeAdmin, loginId]);

  const ownerOptions = useMemo(
    () => [...new Set(contacts.map(contact => contact.owner))]
      .sort((left, right) => (left || "Unassigned").localeCompare(right || "Unassigned")),
    [contacts],
  );

  const ownerFilteredContacts = useMemo(
    () => selectedOwner === ALL_OWNERS
      ? contacts
      : contacts.filter(contact => contact.owner === selectedOwner),
    [contacts, selectedOwner],
  );

  const counts = useMemo(() => Object.fromEntries(
    CONTACT_CATEGORIES.map(category => [
      category,
      ownerFilteredContacts.filter(contact => contact.category === category).length,
    ]),
  ), [ownerFilteredContacts]);

  const selectedContacts = useMemo(
    () => selectedCategory
      ? ownerFilteredContacts.filter(contact => contact.category === selectedCategory)
      : ownerFilteredContacts,
    [ownerFilteredContacts, selectedCategory],
  );

  const sortedContacts = useMemo(() => {
    if (!sortField) return selectedContacts;
    return [...selectedContacts].sort((left, right) => {
      const leftValue = String(left[sortField] ?? "").trim();
      const rightValue = String(right[sortField] ?? "").trim();
      if (!leftValue && !rightValue) return 0;
      if (!leftValue) return 1;
      if (!rightValue) return -1;
      const comparison = NATURAL_COLLATOR.compare(leftValue, rightValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [selectedContacts, sortDirection, sortField]);

  const pageCount = Math.max(1, Math.ceil(sortedContacts.length / pageSize));
  const pagedContacts = useMemo(
    () => sortedContacts.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sortedContacts],
  );

  const quality = useMemo(() => ({
    validEmails: contacts.filter(contact => contact.hasValidEmail).length,
    missingOrInvalid: contacts.filter(contact => !contact.hasValidEmail).length,
    duplicates: contacts.filter(contact => contact.isDuplicate).length,
  }), [contacts]);

  async function handleFile(file) {
    if (!file || importing) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("This first version accepts CSV files. Export the relevant Excel sheet as CSV and try again.");
      return;
    }

    try {
      const parsed = buildContactLists(await file.text());
      setImporting(true);
      setPersistenceStatus("saving");
      const response = await fetch(`${API_BASE}/api/auth/admin/contact-list`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({
          fileName: file.name,
          headerRow: parsed.headerRow,
          contacts: parsed.contacts,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "The imported contacts could not be saved."));
      }
      const workspace = await response.json();
      const savedContacts = refreshContactQuality(workspace.contacts || []);
      setContacts(savedContacts);
      setHeaderRow(workspace.headerRow ?? parsed.headerRow);
      setFileName(workspace.fileName || file.name);
      setPage(1);
      setSelectedOwner(ALL_OWNERS);
      setEditingContactId(null);
      setEditDraft(null);
      const firstPopulated = CONTACT_CATEGORIES.find(category =>
        savedContacts.some(contact => contact.category === category),
      );
      setSelectedCategory(firstPopulated || "Needs review");
      setPersistenceStatus("saved");
    } catch (fileError) {
      setPersistenceStatus("error");
      setError(fileError.message || "The file could not be read.");
    } finally {
      setImporting(false);
    }
  }

  async function persistContact(contact) {
    const response = await fetch(`${API_BASE}/api/auth/admin/contact-list/contacts/${contact.id}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify(contact),
    });
    if (!response.ok) {
      throw new Error(await responseError(response, "The contact could not be saved."));
    }
    return response.json();
  }

  function startEditing(contact) {
    setEditingContactId(contact.id);
    setEditDraft({ ...contact });
  }

  function cancelEditing() {
    setEditingContactId(null);
    setEditDraft(null);
  }

  async function saveEditing() {
    if (!editDraft) return;
    const previousContacts = contacts;
    const nextContacts = refreshContactQuality(contacts.map(contact =>
      contact.id === editDraft.id
        ? { ...contact, ...editDraft, edited: true }
        : contact,
    ));
    setContacts(nextContacts);
    setPersistenceStatus("saving");
    setError("");
    try {
      const saved = await persistContact(nextContacts.find(contact => contact.id === editDraft.id));
      setContacts(current => refreshContactQuality(current.map(contact =>
        contact.id === saved.id ? { ...contact, ...saved } : contact,
      )));
      setPage(1);
      setPersistenceStatus("saved");
      cancelEditing();
    } catch (saveError) {
      setContacts(previousContacts);
      setPersistenceStatus("error");
      setError(saveError.message);
    }
  }

  function exportSelected() {
    downloadCsv(
      `nolyvra-${safeFilename(selectedCategory || "all contacts")}.csv`,
      contactsToCsv(sortedContacts),
    );
  }

  function exportReviewFile() {
    downloadCsv("nolyvra-contact-list-review.csv", contactsToCsv(contacts));
  }

  function sortBy(field) {
    if (sortField === field) {
      setSortDirection(direction => direction === "asc" ? "desc" : "asc");
    } else {
      setSortDirection("asc");
      setSortField(field);
    }
    setPage(1);
    cancelEditing();
  }

  if (adminStatus === "loading") {
    return <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>;
  }

  if (adminStatus === "denied") {
    return (
      <Box sx={{ maxWidth: 720 }}>
        <Alert severity="error" sx={{ mb: 2 }}>Administrator access is required to use this tool.</Alert>
        <Button onClick={() => navigate("/settings/account")} sx={{ textTransform: "none" }}>Back to settings</Button>
      </Box>
    );
  }

  if (adminStatus === "error") {
    return (
      <Box sx={{ maxWidth: 720 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Nolyvra could not verify administrator access. Check the API connection and try again.
        </Alert>
        <Button onClick={() => window.location.reload()} sx={{ textTransform: "none" }}>Try again</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1180, pb: 5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2.5 }}>
        <Box>
          <Button onClick={() => navigate("/settings/tools")} sx={{ px: 0, mb: 0.75, color: MUTED, textTransform: "none", fontSize: 12 }}>
            ← Settings / Tools
          </Button>
          <Typography component="h1" sx={{ fontSize: 22, fontWeight: 750, color: TEXT }}>
            Contact List Builder
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.5 }}>
            Clean, classify and export contact lists without changing the source tracker.
          </Typography>
        </Box>
        {contacts.length > 0 && (
          <Button variant="outlined" onClick={exportReviewFile} sx={{ textTransform: "none", borderRadius: "8px", fontSize: 12 }}>
            Download full review CSV
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 2.5, borderRadius: "9px", fontSize: 12 }}>
        New CSV files are merged by Owner + Contact name. Matching contacts are updated, new contacts are added, and other owners stay unchanged. Consent defaults to Unknown—verify permission before sending marketing communications.
      </Alert>

      <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "12px", p: 2.5, mb: 2.5 }}>
        <Box
          role="button"
          tabIndex={0}
          aria-label="Upload contact CSV"
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }}
          onClick={() => fileRef.current?.click()}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
          sx={{
            border: `2px dashed ${dragging ? ACCENT : BORDER}`,
            borderRadius: "10px",
            bgcolor: dragging ? "#EFF6FF" : SURFACE,
            py: 4,
            px: 2,
            textAlign: "center",
            cursor: "pointer",
            transition: "all .15s",
            "&:hover": { borderColor: ACCENT, bgcolor: "#F5F9FF" },
          }}
        >
          <Typography sx={{ fontSize: 26, mb: 0.75 }}>📋</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: TEXT }}>
            Drop a Master Tracker CSV here or click to browse
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.5 }}>
            Incremental import: updates matching Owner + Contact records without deleting the existing list
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
            {fileName && <Chip label={`${fileName} · header row ${headerRow}`} size="small" sx={{ fontSize: 11 }} />}
            {importing && <Chip label="Importing and saving…" size="small" color="primary" sx={{ fontSize: 11 }} />}
            {!importing && persistenceStatus === "saving" && <Chip label="Saving…" size="small" color="primary" sx={{ fontSize: 11 }} />}
            {!importing && persistenceStatus === "saved" && <Chip label="Saved" size="small" color="success" variant="outlined" sx={{ fontSize: 11 }} />}
          </Box>
        </Box>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={event => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {error && <Alert severity="error" onClose={() => setError("")} sx={{ mt: 2, fontSize: 12 }}>{error}</Alert>}
      </Paper>

      {contacts.length > 0 && (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5, mb: 2.5 }}>
            {[
              ["Contacts detected", contacts.length, TEXT],
              ["Valid email", quality.validEmails, "#15803D"],
              ["Missing / invalid", quality.missingOrInvalid, "#B45309"],
              ["Duplicate emails", quality.duplicates, "#B91C1C"],
            ].map(([label, value, color]) => (
              <Paper key={label} elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", p: 1.75 }}>
                <Typography sx={{ fontSize: 11, color: MUTED }}>{label}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 750, color, mt: 0.25 }}>{value}</Typography>
              </Paper>
            ))}
          </Box>

          <Paper
            elevation={tableFullscreen ? 8 : 0}
            sx={{
              border: `1px solid ${BORDER}`,
              borderRadius: tableFullscreen ? 0 : "12px",
              overflow: "hidden",
              ...(tableFullscreen && {
                position: "fixed",
                inset: 0,
                zIndex: theme => theme.zIndex.modal + 1,
                bgcolor: "#fff",
                display: "flex",
                flexDirection: "column",
              }),
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                select
                size="small"
                label="Owner"
                value={selectedOwner}
                onChange={event => {
                  setSelectedOwner(event.target.value);
                  setPage(1);
                  cancelEditing();
                }}
                sx={{ minWidth: 145, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 11.5 } }}
              >
                <MenuItem value={ALL_OWNERS} sx={{ fontSize: 12 }}>All owners</MenuItem>
                {ownerOptions.map(owner => (
                  <MenuItem key={owner || "unassigned"} value={owner} sx={{ fontSize: 12 }}>
                    {owner || "Unassigned"}
                  </MenuItem>
                ))}
              </TextField>
              {CONTACT_CATEGORIES.map(category => {
                const selected = category === selectedCategory;
                const style = CATEGORY_STYLES[category];
                return (
                  <Button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(current => current === category ? "" : category);
                      setPage(1);
                      cancelEditing();
                    }}
                    aria-pressed={selected}
                    sx={{
                      textTransform: "none",
                      borderRadius: "20px",
                      px: 1.5,
                      py: 0.55,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: selected ? style.color : MUTED,
                      bgcolor: selected ? style.background : "transparent",
                      border: `1px solid ${selected ? style.color : BORDER}`,
                    }}
                  >
                    {category} · {counts[category]}
                  </Button>
                );
              })}
              <Box sx={{ flex: 1 }} />
              <Button
                variant="outlined"
                startIcon={tableFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                onClick={() => setTableFullscreen(current => !current)}
                aria-label={tableFullscreen ? "Exit full screen table" : "View table full screen"}
                sx={{ textTransform: "none", borderRadius: "8px", fontSize: 12, whiteSpace: "nowrap" }}
              >
                {tableFullscreen ? "Exit full screen" : "Full screen table"}
              </Button>
              <Button
                variant="contained"
                disabled={sortedContacts.length === 0}
                onClick={exportSelected}
                sx={{ textTransform: "none", borderRadius: "8px", fontSize: 12, boxShadow: "none" }}
              >
                Download current list
              </Button>
            </Box>

            <Box sx={{ overflow: "auto", ...(tableFullscreen && { flex: 1, minHeight: 0 }) }}>
              <Table stickyHeader={tableFullscreen} size="small" aria-label={`${selectedCategory || "All categories"} contacts`}>
                <TableHead>
                  <TableRow sx={{ bgcolor: SURFACE }}>
                    {TABLE_COLUMNS.map(([field, label]) => (
                      <TableCell
                        key={field}
                        sortDirection={sortField === field ? sortDirection : false}
                        sx={{ fontSize: 10.5, fontWeight: 700, color: MUTED, whiteSpace: "nowrap", borderBottom: `1px solid ${BORDER}` }}
                      >
                        <TableSortLabel
                          active={sortField === field}
                          direction={sortField === field ? sortDirection : "asc"}
                          onClick={() => sortBy(field)}
                          sx={{ fontSize: 10.5, fontWeight: 700, color: `${MUTED} !important` }}
                        >
                          {label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    <TableCell sx={{ borderBottom: `1px solid ${BORDER}` }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedContacts.length === 0 ? (
                    <TableRow><TableCell colSpan={18} sx={{ textAlign: "center", py: 5, color: MUTED, fontSize: 12 }}>No contacts in this list.</TableCell></TableRow>
                  ) : pagedContacts.map(contact => (
                    <Fragment key={contact.id}>
                    <TableRow hover selected={editingContactId === contact.id}>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 130 }}>{contact.company || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: TEXT, fontWeight: 600, minWidth: 150 }}>{contact.name || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 130 }}>{contact.phone || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: contact.hasValidEmail ? TEXT : "#B45309", minWidth: 190 }}>{contact.email || "Missing"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 130 }}>{contact.role || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 110 }}>{contact.segment || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 110 }}>{contact.source || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: MUTED }}>{contact.owner || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 110 }}>{contact.stage || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 105 }}>{contact.dateAdded || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 105 }}>{contact.lastContact || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 125 }}>{contact.nextActionDate || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 220 }}>{contact.nextStep || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 130 }}>{contact.packageName || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 125 }}>{contact.potentialMrr || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: TEXT, minWidth: 220 }}>{contact.notes || "—"}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Chip
                          label={contact.category}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: 10.5,
                            fontWeight: 650,
                            color: CATEGORY_STYLES[contact.category]?.color || MUTED,
                            bgcolor: CATEGORY_STYLES[contact.category]?.background || SURFACE,
                            border: `1px solid ${CATEGORY_STYLES[contact.category]?.color || BORDER}`,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => startEditing(contact)} sx={{ textTransform: "none", fontSize: 11 }}>Edit</Button>
                      </TableCell>
                    </TableRow>
                    {editingContactId === contact.id && editDraft && (
                      <TableRow>
                        <TableCell colSpan={18} sx={{ bgcolor: "#F8FAFC", p: 2, borderBottom: `1px solid ${BORDER}` }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1.5 }}>
                            Edit contact
                          </Typography>
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.25 }}>
                            {[
                              ["name", "Contact name"], ["company", "Company"], ["email", "Email"],
                              ["phone", "Phone"], ["role", "Role"], ["segment", "Segment"],
                              ["source", "Source"], ["owner", "Owner"], ["stage", "Stage"],
                              ["dateAdded", "Date added"], ["lastContact", "Last contact"],
                              ["nextActionDate", "Next action date"], ["nextStep", "Next step"],
                              ["packageName", "Package"], ["potentialMrr", "Potential MRR ($)"],
                            ].map(([field, label]) => (
                              <TextField
                                key={field}
                                size="small"
                                label={label}
                                value={editDraft[field] || ""}
                                onChange={event => setEditDraft(current => ({ ...current, [field]: event.target.value }))}
                                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: 12 } }}
                              />
                            ))}
                            <TextField
                              select size="small" label="Category" value={editDraft.category}
                              onChange={event => setEditDraft(current => ({ ...current, category: event.target.value }))}
                              sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: 12 } }}
                            >
                              {CONTACT_CATEGORIES.map(category => <MenuItem key={category} value={category}>{category}</MenuItem>)}
                            </TextField>
                            <TextField
                              select size="small" label="Consent status" value={editDraft.consentStatus}
                              onChange={event => setEditDraft(current => ({ ...current, consentStatus: event.target.value }))}
                              sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: 12 } }}
                            >
                              {["Unknown", "Confirmed", "Unsubscribed"].map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                            </TextField>
                            <TextField
                              size="small" label="Notes" value={editDraft.notes || ""} multiline minRows={1}
                              onChange={event => setEditDraft(current => ({ ...current, notes: event.target.value }))}
                              sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: 12 } }}
                            />
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
                            <Button size="small" onClick={cancelEditing} sx={{ textTransform: "none" }}>Cancel</Button>
                            <Button size="small" variant="contained" onClick={saveEditing} sx={{ textTransform: "none", boxShadow: "none" }}>Save changes</Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {selectedContacts.length > 0 && (
              <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: 11, color: MUTED }}>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, selectedContacts.length)} of {selectedContacts.length} contacts
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <TextField
                    select size="small" label="Rows" value={pageSize}
                    onChange={event => { setPageSize(Number(event.target.value)); setPage(1); cancelEditing(); }}
                    sx={{ width: 92, "& .MuiOutlinedInput-root": { fontSize: 11.5 } }}
                  >
                    {[25, 50, 100].map(size => <MenuItem key={size} value={size}>{size}</MenuItem>)}
                  </TextField>
                  <Pagination
                    count={pageCount} page={Math.min(page, pageCount)}
                    onChange={(_, nextPage) => { setPage(nextPage); cancelEditing(); }}
                    size="small" color="primary" showFirstButton showLastButton
                  />
                </Box>
              </Box>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
