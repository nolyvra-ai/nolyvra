import { Box } from "@mui/material";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({ children }) {
  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />

      <Box sx={{ flex: 1, display: "flex", minWidth: 0 }}>
        <Sidebar />

        {/* Main content */}
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 3 }}>
          {/* Remove any max width constraint */}
          <Box sx={{ width: "100%", maxWidth: "none" }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
