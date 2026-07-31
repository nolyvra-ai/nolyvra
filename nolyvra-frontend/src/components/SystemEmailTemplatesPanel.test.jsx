import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import SystemEmailTemplatesPanel from "./SystemEmailTemplatesPanel";

const template = {
  key: "password_reset",
  name: "Password reset",
  subject: "Reset your password",
  htmlBody: "<a href=\"{{reset_link}}\">Reset</a><p>{{expiry_minutes}}</p>",
  textBody: "{{reset_link}} expires in {{expiry_minutes}} minutes",
  enabled: true,
  version: 1,
  updatedAt: null,
  customized: true,
  supportedVariables: ["reset_link", "expiry_minutes"],
  requiredVariables: ["reset_link", "expiry_minutes"],
};

function jsonResponse(data, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) });
}

function renderPanel(selectedKey) {
  return render(
    <MemoryRouter>
      <SystemEmailTemplatesPanel selectedKey={selectedKey} />
    </MemoryRouter>
  );
}

function RoutedPanel() {
  const { templateKey } = useParams();
  const location = useLocation();
  return <>
    <SystemEmailTemplatesPanel selectedKey={templateKey} />
    <span data-testid="location">{location.pathname}</span>
  </>;
}

describe("SystemEmailTemplatesPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("loginId", "admin");
    localStorage.setItem("sessionToken", "token");
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("fetch", vi.fn(url => {
      if (String(url).endsWith("/status?loginId=admin")) return jsonResponse({ resendConfigured: true });
      return jsonResponse([template]);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a compact template list and safe Resend status", async () => {
    renderPanel();

    expect(await screen.findByRole("button", { name: /Password reset/ })).toBeInTheDocument();
    expect(screen.getByText("Resend: Configured")).toBeInTheDocument();
    expect(screen.queryByLabelText("Subject")).not.toBeInTheDocument();
  });

  it("keeps a valid selected template route open after templates load", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/email/password_reset"]}>
        <Routes>
          <Route path="/settings/email/:templateKey" element={<RoutedPanel />} />
          <Route path="/settings/email" element={<RoutedPanel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings/email/password_reset");
  });

  it("defaults to visual editing and keeps HTML source in sync", async () => {
    renderPanel("password_reset");
    const visualEditor = await screen.findByRole("textbox", { name: "Email body editor" });
    expect(visualEditor.innerHTML).toContain("{{reset_link}}");
    expect(screen.getByRole("toolbar", { name: "Email formatting" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Plain-text body")).not.toBeInTheDocument();

    visualEditor.innerHTML = "<p>No reset link</p>";
    fireEvent.input(visualEditor);
    fireEvent.click(screen.getByRole("button", { name: "Advanced options" }));
    expect(screen.getByLabelText("Plain-text body")).toHaveValue("No reset link");
    fireEvent.change(screen.getByLabelText("Plain-text body"), { target: { value: "No variables" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required variable is missing: reset_link")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("checkbox", { name: "Show HTML code" }));
    expect(screen.getByLabelText("HTML body")).toHaveValue("<p>No reset link</p>");
  }, 10000);

  it("saves changes and reports API errors", async () => {
    fetch.mockImplementation((url, options = {}) => {
      if (String(url).endsWith("/status?loginId=admin")) return jsonResponse({ resendConfigured: false });
      if (options.method === "PUT") return jsonResponse({ error: "Version conflict" }, false);
      return jsonResponse([template]);
    });
    renderPanel("password_reset");
    const subject = await screen.findByLabelText("Subject");
    fireEvent.change(subject, { target: { value: "Updated reset subject" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Version conflict")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/password_reset?loginId=admin"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("restores a customized template to its default", async () => {
    const restored = { ...template, customized: false, version: 0 };
    fetch.mockImplementation((url, options = {}) => {
      if (String(url).endsWith("/status?loginId=admin")) return jsonResponse({ resendConfigured: true });
      if (options.method === "DELETE") return jsonResponse(restored);
      return jsonResponse([template]);
    });
    renderPanel("password_reset");
    fireEvent.click(await screen.findByRole("button", { name: "Restore default" }));

    expect(await screen.findByText("Default restored.")).toBeInTheDocument();
    expect(confirm).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("version=1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
