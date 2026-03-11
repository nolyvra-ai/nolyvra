import { BrowserRouter, useLocation, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import AppRoutes from "./routes/AppRoutes";

function Layout() {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login";
  const isLoggedIn = !!localStorage.getItem("loginId");

  if (!isLoggedIn && !isLogin) return <Navigate to="/login" replace />;
  if (isLogin) return <AppRoutes />;

  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}

export default Layout;