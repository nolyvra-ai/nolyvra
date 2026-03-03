import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",

    primary: { main: "#1D72E8" },

    background: {
      default: "#F7F8FA",
      paper: "#FFFFFF",
    },

    text: {
      primary: "#0F1623",
      secondary: "#5A6480",
    },

    divider: "#E2E6ED",

    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
  },

  shape: { borderRadius: 10 },

  typography: {
    fontFamily: ["DM Sans", "Inter", "system-ui", "Arial"].join(","),
    h5: { fontWeight: 800 },
    h4: { fontWeight: 800 },
    body2: { color: "#5A6480" },
  },

  components: {
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: "1px solid #E2E6ED",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#5A6480",
          fontWeight: 700,
          borderBottom: "1px solid #E2E6ED",
        },
        body: {
          borderBottom: "1px solid #E2E6ED",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;