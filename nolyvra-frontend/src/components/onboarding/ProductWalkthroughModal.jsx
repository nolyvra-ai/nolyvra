import { useState } from "react";
import { Box, Dialog, IconButton, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { WALKTHROUGH_STEPS } from "../../data/walkthroughSteps";

const ACCENT = "#1D72E8";
const TEXT = "#0F1623";
const MUTED = "#5A6480";
const BORDER = "#E2E6ED";

// First-login product walkthrough. No persistence by design (iteration 1) —
// the parent decides when to render this, and it always resets to step 0
// on close so it looks the same every time it's shown.
export default function ProductWalkthroughModal({ open, onClose }) {
  const [index, setIndex] = useState(0);
  const nav = useNavigate();

  const step = WALKTHROUGH_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === WALKTHROUGH_STEPS.length - 1;

  function handleClose() {
    onClose();
    setIndex(0);
  }

  function handleNext() {
    if (!isLast) setIndex((i) => i + 1);
  }

  function handleBack() {
    if (!isFirst) setIndex((i) => i - 1);
  }

  function handleGoToHelp() {
    handleClose();
    nav("/help?category=getting-started&article=product-walkthrough-video");
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: "14px" } }}
    >
      <Box sx={{ position: "relative", p: 3.5 }}>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Close walkthrough"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            bgcolor: "#F7F8FA",
            border: `1px solid ${BORDER}`,
            zIndex: 1,
            "&:hover": { bgcolor: "#F0F2F6" },
          }}
        >
          ✕
        </IconButton>

        <Box
          sx={{
            height: 180,
            borderRadius: "10px",
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            background: "linear-gradient(135deg, #1D72E8 0%, #3D8EFF 55%, #7C3AED 100%)",
          }}
        >
          {step.icon}
        </Box>

        <Typography variant="h5" sx={{ mt: 2, mb: 1, color: TEXT, fontWeight: 800 }}>
          {step.headline}
        </Typography>
        <Typography sx={{ fontSize: 14.5, color: MUTED, lineHeight: 1.6, mb: 3 }}>
          {step.body}
        </Typography>

        {/* Step indicator dots */}
        <Box sx={{ display: "flex", gap: 0.75, justifyContent: "center", mb: 3 }}>
          {WALKTHROUGH_STEPS.map((s, i) => (
            <Box
              key={s.slug}
              sx={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: "3px",
                bgcolor: i === index ? ACCENT : "#E2E6ED",
                transition: "all .2s",
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Button
            onClick={handleBack}
            sx={{
              textTransform: "none",
              color: MUTED,
              fontWeight: 600,
              visibility: isFirst ? "hidden" : "visible",
            }}
          >
            ← Back
          </Button>

          <Button
            onClick={isLast ? handleGoToHelp : handleNext}
            variant="contained"
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "8px",
              px: 3,
              bgcolor: ACCENT,
              boxShadow: "none",
              "&:hover": { bgcolor: "#1660c9", boxShadow: "none" },
            }}
          >
            {isLast ? "Go to Help Center" : "Next →"}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
