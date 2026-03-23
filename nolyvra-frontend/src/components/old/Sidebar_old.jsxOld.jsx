import { Drawer, List, ListItemButton, ListItemText, ListSubheader } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const W = 200;

function NavItem({ to, label }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <ListItemButton
      onClick={() => nav(to)}
      selected={active}
      sx={{
        borderRadius: 1,
        mx: 1,
        my: 0.25,
        color: "rgba(255,255,255,.75)",
        "&.Mui-selected": { bgcolor: "rgba(29,114,232,.25)", color: "white" },
        "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
      }}
    >
      <ListItemText primary={label} />
    </ListItemButton>
  );
}

export default function Sidebar() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: W,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: W,
          bgcolor: "#0F1623",
          color: "white",
          borderRight: "1px solid rgba(255,255,255,.08)",
          boxShadow: "none",
          border: "none",
        },
      }}
    >
      <List
        subheader={
          <ListSubheader sx={{ bgcolor: "transparent", color: "rgba(255,255,255,.35)" }}>
            Overview
          </ListSubheader>
        }
      >
        <NavItem to="/dashboard" label="Dashboard" />
      </List>

      <List
        subheader={
          <ListSubheader sx={{ bgcolor: "transparent", color: "rgba(255,255,255,.35)" }}>
            Jobs
          </ListSubheader>
        }
      >
        <NavItem to="/jobs" label="All Jobs" />
        <NavItem to="/jobs/new" label="Create Job" />
      </List>

      <List
        subheader={
          <ListSubheader sx={{ bgcolor: "transparent", color: "rgba(255,255,255,.35)" }}>
            Candidates
          </ListSubheader>
        }
      >
        <NavItem to="/candidates" label="All Candidates" />
        <NavItem to="/candidates/new" label="Add Candidate" />
      </List>
    </Drawer>
  );
}
