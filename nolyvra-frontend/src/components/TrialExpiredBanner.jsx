import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";

export default function TrialExpiredBanner() {
  const { usage } = usePlanLimit();
  const navigate = useNavigate();

  if (!usage?.trialExpired) return null;

  const loginId = localStorage.getItem("loginId") || "";

  return (
    <Box sx={{
      bgcolor: "#DC2626",
      color: "#fff",
      px: 3,
      py: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      flexWrap: "wrap",
    }}
    >
      <Typography variant="body2" fontWeight={600}>
        Your free plan has expired. Select a subscription to keep using Nolyvra.
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={() => navigate(`/pricing?loginId=${encodeURIComponent(loginId)}`)}
        sx={{
          bgcolor: "#fff", color: "#DC2626", fontWeight: 700,
          "&:hover": { bgcolor: "#F3F4F6" },
        }}
      >
        Select a Plan
      </Button>
    </Box>
  );
}
