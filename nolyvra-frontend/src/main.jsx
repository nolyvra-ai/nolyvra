import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import App from "./App";
import theme from "./theme/theme";
import "./index.css"

const _nativeFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await _nativeFetch(...args);
  if (response.status === 401) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    if (url.includes("/api/") && localStorage.getItem("loginId") && window.location.pathname !== "/login") {
      localStorage.removeItem("loginId");
      localStorage.removeItem("name");
      localStorage.removeItem("sessionToken");
      window.location.href = "/login";
    }
  }
  return response;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
     <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
