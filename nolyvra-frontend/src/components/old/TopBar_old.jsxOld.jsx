import { AppBar, Toolbar, Typography, Box, Chip } from "@mui/material";

export default function TopBar() {
  return (
    <AppBar position="static" sx={{ bgcolor: "#0F1623" }}>
      <Toolbar sx={{ gap: 2 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            bgcolor: "primary.main",
            borderRadius: 1,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
          }}
        >
          IQ
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, lineHeight: 1 }}>
            nolyvra
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.5 }}>
            MVP v0.1
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />
        <Chip size="small" label="Recruiter View" sx={{ bgcolor: "rgba(255,255,255,.08)", color: "white" }} />
      </Toolbar>
    </AppBar>
  );
}
