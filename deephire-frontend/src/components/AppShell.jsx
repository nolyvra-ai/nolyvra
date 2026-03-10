import { Box } from "@mui/material";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";


export default function AppShell({ children }) {
  return (
    <Box sx={{ height: "100vh", display: "flex", overflow: "hidden" }}>
      <Sidebar />

      {/* Content column — TopBar + page content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar />
        {/* Main content */}
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 3 }}>
          <Box sx={{ width: "100%", maxWidth: "none" }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
