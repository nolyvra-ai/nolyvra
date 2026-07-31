import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SettingsPage from "./SettingsPage";

vi.mock("../hooks/usePlanLimit", () => ({
  usePlanLimit: () => ({ usage: null, loading: false }),
}));

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderSettings(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/:section" element={<><SettingsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

function response(ok, data = {}) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe("SettingsPage navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("loginId", "user-1");
    localStorage.setItem("name", "Test User");
    localStorage.setItem("sessionToken", "token");
    localStorage.setItem("authType", "TENANT");
    vi.stubGlobal("fetch", vi.fn(url => {
      if (String(url).includes("/api/auth/admin/users")) return response(false);
      return response(true);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders desktop and compact navigation for personal settings", async () => {
    renderSettings("/settings/account");

    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    expect(screen.getByLabelText("Settings section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account Password and session/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Update Password")).not.toHaveLength(0);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Administration/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Email & Notifications/ })).not.toBeInTheDocument();
  });

  it("redirects a non-admin away from protected settings", async () => {
    renderSettings("/settings/email");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings/account"));
  });

  it("keeps employee settings limited to password and logout", () => {
    localStorage.setItem("authType", "EMPLOYEE");
    renderSettings("/settings/admin");

    expect(screen.getAllByText("Update Password")).not.toHaveLength(0);
    expect(screen.getAllByText("Logout")).not.toHaveLength(0);
    expect(screen.queryByRole("navigation", { name: "Settings sections" })).not.toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("shows protected categories to administrators", async () => {
    fetch.mockImplementation(url => {
      if (String(url).includes("/api/auth/admin/users")) return response(true, []);
      if (String(url).includes("/api/stack-audit/leads")) return response(true, []);
      return response(true);
    });
    renderSettings("/settings/admin");

    expect(await screen.findByRole("button", { name: /Administration Users, limits and leads/ }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Email & Notifications/ })).toBeInTheDocument();
  });
});
