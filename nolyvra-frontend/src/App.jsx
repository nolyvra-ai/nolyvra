import { BrowserRouter, useLocation, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import AppRoutes from "./routes/AppRoutes";
import { AppModeProvider } from "./context/AppModeContext";

// Routes that are fully public — no auth check, no AppShell
const PUBLIC_ROUTES = ["/", "/pricing", "/login", "/forgot-password", "/reset-password", "/ai-in-recruitment", "/stack-audit", "/privacy", "/terms", "/recruitment-united"];

// Employee sessions may only ever reach these — everything else (RecruitIQ,
// tenant-admin CRM screens) redirects back. Mirrors the server-side allowlist
// in SessionInterceptor.java; this is the UX guard, not the security boundary.
const EMPLOYEE_ROUTES = ["/crm/my-leave", "/crm/my-expenses", "/crm/my-grievances", "/crm/my-timesheet", "/settings", "/settings/account"];

function Layout() {
  const { pathname } = useLocation();
  const isPublic   = PUBLIC_ROUTES.includes(pathname);
  const isLoggedIn = !!localStorage.getItem("loginId");
  const isEmployee = localStorage.getItem("authType") === "EMPLOYEE";

  // Unauthenticated users trying to access app pages → send to landing
  if (!isLoggedIn && !isPublic) return <Navigate to="/" replace />;

  // Employee sessions are confined to their own self-service pages
  if (isLoggedIn && isEmployee && !isPublic && !EMPLOYEE_ROUTES.includes(pathname)) {
    return <Navigate to="/crm/my-leave" replace />;
  }

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
