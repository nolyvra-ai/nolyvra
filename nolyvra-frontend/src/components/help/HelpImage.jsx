import { useState } from "react";
import { Box } from "@mui/material";

// Renders a real screenshot when it exists under /public/help-assets/...,
// otherwise a styled placeholder using the markdown alt text — lets articles
// reference screenshots that haven't been captured yet without breaking layout.
export default function HelpImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <Box
        sx={{
          my: 2,
          py: 6,
          px: 3,
          borderRadius: "10px",
          border: "1px dashed #C7CEDB",
          bgcolor: "#F7F8FA",
          color: "#5A6480",
          textAlign: "center",
          fontSize: 13,
        }}
      >
        <Box sx={{ fontSize: 22, mb: 1 }}>🖼</Box>
        {alt || "Screenshot coming soon"}
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      sx={{ maxWidth: "100%", borderRadius: "10px", border: "1px solid #E2E6ED", my: 2, display: "block" }}
    />
  );
}
