import { useState } from "react";
import { Button, Menu, MenuItem, Checkbox, ListItemText, Divider, Typography } from "@mui/material";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";

const BORDER = "#E8ECF2", TEXT = "#0F1623", MUTED = "#9AA3B4", SURFACE = "#FAFBFD";

// Generic "add extra columns" menu, shared by JobsPage.jsx (jobs table +
// per-job candidate sub-table) and CandidatesPage.jsx (main list). Existing
// table columns are untouched — checking an option here just appends that
// field as an extra column; selection is plain component state (resets on
// every visit, no persistence).
export default function ColumnPickerButton({ options, selected, onToggle }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Button size="small" variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<ViewColumnIcon sx={{ fontSize: 14 }} />}
        sx={{
          fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
          borderRadius: "6px", textTransform: "none",
          "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE }
        }}>
        Columns{selected.size > 0 ? ` (${selected.size})` : ""}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { maxHeight: 360, minWidth: 220 } }}>
        <Typography sx={{
          fontSize: 10.5, fontWeight: 700, color: MUTED, px: 2, py: 1,
          textTransform: "uppercase", letterSpacing: ".4px"
        }}>
          Add Columns
        </Typography>
        <Divider />
        {options.map(opt => (
          <MenuItem key={opt.key} dense onClick={() => onToggle(opt.key)} sx={{ py: 0.25 }}>
            <Checkbox size="small" checked={selected.has(opt.key)} sx={{ p: 0.5, mr: 1 }} />
            <ListItemText primaryTypographyProps={{ fontSize: 12.5, color: TEXT }}>
              {opt.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
