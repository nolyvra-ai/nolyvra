import { Box, Typography } from "@mui/material";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8", ACCENT_BG = "#EBF2FF";
const SURFACE = "#FAFBFD";

function connect(provider) {
  const loginId = localStorage.getItem("loginId") || "";
  window.location.href = `${API_BASE}/auth/${provider}/connect?loginId=${encodeURIComponent(loginId)}`;
}

function ViewItem({ icon, label, count, active, onClick }) {
  return (
    <Box onClick={onClick} sx={{
      display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.9, borderRadius: "8px",
      cursor: "pointer", bgcolor: active ? ACCENT_BG : "transparent", color: active ? ACCENT : TEXT,
      "&:hover": { bgcolor: active ? ACCENT_BG : "#F0F2F6" },
    }}>
      {icon}
      <Typography sx={{ fontSize: 12.5, fontWeight: active ? 700 : 500, flex: 1 }}>{label}</Typography>
      {count != null && count > 0 && (
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: active ? ACCENT : MUTED }}>{count}</Typography>
      )}
    </Box>
  );
}

// Sidebar for the Email Centre inbox — mailbox switcher (when more than one
// provider is connected) plus the views actually backed by real data: a live
// Inbox/Unread proxy over the connected mailbox, and Sent from the existing
// local email_history. No Later/Snoozed/VIP — those aren't real states either
// provider's API exposes, and we deliberately don't store anything locally.
export default function InboxSidebar({ providers, activeProvider, onProviderChange, activeView, onViewChange, unreadCount }) {
  const connectedProviders = [
    providers?.google?.connected && { key: "google", label: "Gmail", email: providers.google.email },
    providers?.microsoft?.connected && { key: "microsoft", label: "Outlook", email: providers.microsoft.email },
  ].filter(Boolean);

  return (
    <Box sx={{ flex: "0 0 200px", borderRight: `1px solid ${BORDER}`, bgcolor: SURFACE, p: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
      {connectedProviders.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {connectedProviders.length > 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography sx={{ fontSize: 10.5, color: MUTED, fontWeight: 600, px: 0.5 }}>MAILBOX</Typography>
              {connectedProviders.map(p => (
                <Box key={p.key} onClick={() => onProviderChange(p.key)} sx={{
                  px: 1.5, py: 0.75, borderRadius: "8px", cursor: "pointer",
                  bgcolor: activeProvider === p.key ? "#fff" : "transparent",
                  border: activeProvider === p.key ? `1px solid ${BORDER}` : "1px solid transparent",
                }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{p.label}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.email}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <ViewItem icon={<InboxRoundedIcon sx={{ fontSize: 17 }} />} label="All" active={activeView === "all"} onClick={() => onViewChange("all")} />
            <ViewItem icon={<MarkEmailUnreadRoundedIcon sx={{ fontSize: 17 }} />} label="Unread" count={unreadCount} active={activeView === "unread"} onClick={() => onViewChange("unread")} />
            <ViewItem icon={<SendRoundedIcon sx={{ fontSize: 17 }} />} label="Sent" active={activeView === "sent"} onClick={() => onViewChange("sent")} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <ViewItem icon={<SendRoundedIcon sx={{ fontSize: 17 }} />} label="Sent" active={activeView === "sent"} onClick={() => onViewChange("sent")} />
        </Box>
      )}

      <Box sx={{ mt: "auto", p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: TEXT, mb: 0.75 }}>
          {connectedProviders.length > 0 ? "Connect another mailbox" : "Connect a mailbox"}
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: MUTED, mb: 1, lineHeight: 1.5 }}>
          See your real inbox here — nothing is copied or stored, it's read live.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {!providers?.google?.connected && (
            <Box onClick={() => connect("google")} sx={{
              fontSize: 11, fontWeight: 600, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" },
            }}>Connect Gmail →</Box>
          )}
          {!providers?.microsoft?.connected && (
            <Box onClick={() => connect("microsoft")} sx={{
              fontSize: 11, fontWeight: 600, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" },
            }}>Connect Outlook →</Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
