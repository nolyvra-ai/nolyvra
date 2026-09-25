import { Box, Typography, CircularProgress, Button } from "@mui/material";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const ACCENT_BG = "#EBF2FF";

function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Presentational middle pane — works identically for live-inbox rows and Sent
// rows, since the parent normalizes both into the same row shape before this
// ever sees them.
export default function ConversationList({ rows, loading, selectedKey, onSelect, hasMore, onLoadMore, loadingMore, emptyLabel }) {
  return (
    <Box sx={{ flex: "0 0 320px", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={20} sx={{ color: ACCENT }} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: MUTED }}>{emptyLabel || "Nothing here yet."}</Typography>
          </Box>
        ) : rows.map(row => (
          <Box key={row.key} onClick={() => onSelect(row)} sx={{
            px: 2, py: 1.25, borderBottom: "1px solid #F0F2F6", cursor: "pointer",
            bgcolor: selectedKey === row.key ? ACCENT_BG : "#fff",
            "&:hover": { bgcolor: selectedKey === row.key ? ACCENT_BG : "#F7F9FF" },
          }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                {row.unread && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: ACCENT, flexShrink: 0 }} />}
                <Typography sx={{
                  fontSize: 12.5, fontWeight: row.unread ? 700 : 500, color: TEXT,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {row.personLabel || "—"}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 10.5, color: MUTED, flexShrink: 0 }}>{formatTimestamp(row.timestamp)}</Typography>
            </Box>
            <Typography sx={{
              fontSize: 12, fontWeight: row.unread ? 600 : 400, color: row.unread ? TEXT : MUTED, mt: 0.25,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {row.title || "(no subject)"}
            </Typography>
            {row.preview && (
              <Typography sx={{
                fontSize: 11, color: MUTED, mt: 0.25,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {row.preview}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      {hasMore && (
        <Box sx={{ p: 1.25, borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
          <Button size="small" onClick={onLoadMore} disabled={loadingMore}
            sx={{ fontSize: 11, textTransform: "none", color: ACCENT }}>
            {loadingMore ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : "Load more"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
