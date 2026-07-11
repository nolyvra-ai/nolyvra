import { BrowserRouter, useLocation, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import AppRoutes from "./routes/AppRoutes";
import { AppModeProvider } from "./context/AppModeContext";

// Routes that are fully public — no auth check, no AppShell
const PUBLIC_ROUTES = ["/", "/pricing", "/login", "/ai-in-recruitment", "/stack-audit", "/privacy", "/terms"];

function Layout() {
  const { pathname } = useLocation();
  const isPublic   = PUBLIC_ROUTES.includes(pathname);
  const isLoggedIn = !!localStorage.getItem("loginId");

  // Unauthenticated users trying to access app pages → send to landing
  if (!isLoggedIn && !isPublic) return <Navigate to="/" replace />;

  // Public pages render without AppShell (no sidebar / topbar)
  if (isPublic) return <AppRoutes />;

  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}

export default function App() {
  return (
    <AppModeProvider>
      <Layout />
    </AppModeProvider>
  );
}