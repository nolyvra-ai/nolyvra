import { useMemo, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import { helpArticles } from "../../content/help";

const ACCENT = "#1D72E8";
const TEXT = "#0F1623";
const TEXT_SEC = "#5A6480";
const BORDER = "#E2E6ED";
const SURFACE = "#F7F8FA";

// Persists across page loads until the user closes it — matches the
// HubSpot Trial Guide's "stays minimized until reopened" behavior.
const STORAGE_KEY = "nolyvra.gettingStartedGuide.expanded";

// Positioned bottom-right, stacked *above* SupportChatWidget's floating
// button (56px + 24px margin = 80px from viewport bottom) rather than
// bottom-left like the HubSpot reference — the Sidebar's own "Go Premium"
// card sits in normal flow at the bottom-left of that column, and a fixed
// widget there would float directly on top of it.
const STACK_BOTTOM = 92;

export default function GettingStartedGuideWidget() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  const videoArticles = useMemo(
    () => helpArticles.filter((a) => a.category === "getting-started" && a.hasVideo),
    []
  );

  function setExpandedPersist(value) {
    setExpanded(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }

  function goToArticle(article) {
    navigate(`/help?category=${article.category}&article=${article.slug}`);
  }

  if (videoArticles.length === 0) return null;

  if (!expanded) {
    return (
      <Box
        onClick={() => setExpandedPersist(true)}
        sx={{
          position: "fixed", right: 24, bottom: STACK_BOTTOM, zIndex: 1250,
          display: "flex", alignItems: "center", gap: 0.75,
          bgcolor: ACCENT, color: "#fff", borderRadius: "999px",
          px: 2, py: 1.1, cursor: "pointer", boxShadow: "0 6px 20px rgba(29,114,232,0.35)",
          fontSize: 13, fontWeight: 700, "&:hover": { bgcolor: "#1660CC" },
        }}
      >
        <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
        Getting Started
      </Box>
    );
  }

  return (
    <Box sx={{
      position: "fixed", right: 24, bottom: STACK_BOTTOM, zIndex: 1250,
      width: 320, borderRadius: "14px", overflow: "hidden",
      bgcolor: "#fff", boxShadow: "0 20px 50px rgba(15,22,35,0.25)",
      border: `1px solid ${BORDER}`,
    }}>
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        px: 1.75, py: 1.25, borderBottom: `1px solid ${BORDER}`,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <DragIndicatorRoundedIcon sx={{ fontSize: 16, color: "#C4C9D4" }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Getting Started</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton size="small" onClick={() => navigate("/help?category=getting-started")} sx={{ color: TEXT_SEC }}>
            <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => setExpandedPersist(false)} sx={{ color: TEXT_SEC }}>
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ py: "6px" }}>
        {videoArticles.map((a) => (
          <Box
            key={a.slug}
            onClick={() => goToArticle(a)}
            sx={{
              display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 1.1,
              cursor: "pointer", borderBottom: `1px solid ${SURFACE}`,
              "&:last-of-type": { borderBottom: "none" },
              "&:hover": { bgcolor: SURFACE },
            }}
          >
            <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18, color: ACCENT, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, color: TEXT, lineHeight: 1.4 }}>
              {a.title}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        onClick={() => navigate("/help")}
        sx={{
          px: 1.75, py: 1.1, bgcolor: SURFACE, borderTop: `1px solid ${BORDER}`,
          textAlign: "center", cursor: "pointer",
          "&:hover": { bgcolor: "#F0F2F6" },
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
          See all guides →
        </Typography>
      </Box>
    </Box>
  );
}
