import { Box } from "@mui/material";

// Responsive 16:9 video block. Renders the embed once `src` (a Gumlet/iframe
// embed URL) is set on the article; otherwise a placeholder so the layout
// works today and the real video can be dropped in later without touching code.
export default function HelpVideo({ src, title, aspect = "16 / 9" }) {
  if (!src) {
    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: aspect,
          borderRadius: "10px",
          border: "1px dashed #C7CEDB",
          bgcolor: "#F7F8FA",
          mb: 3,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            color: "#5A6480",
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "#fff",
              border: "1px solid #E2E6ED",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: "#1D72E8",
            }}
          >
            ▶
          </Box>
          <Box sx={{ fontSize: 13, fontWeight: 600 }}>Video walkthrough — coming soon</Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: aspect,
        borderRadius: "10px",
        border: "1px solid #E2E6ED",
        overflow: "hidden",
        mb: 3,
      }}
    >
      <Box
        component="iframe"
        src={src}
        title={title || "Video walkthrough"}
        loading="lazy"
        referrerPolicy="origin"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write;"
        allowFullScreen
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
    </Box>
  );
}
