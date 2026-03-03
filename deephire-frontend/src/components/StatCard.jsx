import { Paper, Typography, Box } from "@mui/material";

export default function StatCard({
  label,
  value,
  subtext,
  accent = "primary", // "success" | "primary" | "error" | "warning"
}) {
  const colorMap = {
    primary: "#1D72E8",
    success: "#16A34A",
    error: "#DC2626",
    warning: "#D97706",
  };

  const accentColor = colorMap[accent] || colorMap.primary;

  return (
    <Paper
      sx={{
        width: "100%",
        p: 2.5,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        minHeight: 110,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* subtle accent strip */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: accentColor,
          opacity: 0.9,
        }}
      />

      <Typography
        variant="overline"
        sx={{
          letterSpacing: 0.8,
          fontWeight: 800,
          color: "text.secondary",
        }}
      >
        {label}
      </Typography>

      <Typography
        variant="h3"
        sx={{
          fontWeight: 900,
          lineHeight: 1,
          color: accent === "primary" ? "#0F1623" : accentColor,
        }}
      >
        {value}
      </Typography>

      {subtext ? (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: accentColor,
            mt: 0.5,
          }}
        >
          {subtext}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          &nbsp;
        </Typography>
      )}
    </Paper>
  );
}
