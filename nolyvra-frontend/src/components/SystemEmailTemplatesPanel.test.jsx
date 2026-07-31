import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

  it("edits, validates required variables, and previews in a sandboxed frame", async () => {
    renderPanel("password_reset");
    const html = await screen.findByLabelText("HTML body");

    fireEvent.change(html, { target: { value: "<p>No reset link</p>" } });
    fireEvent.change(screen.getByLabelText("Plain-text body"), { target: { value: "No variables" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required variable is missing: reset_link")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const frame = await screen.findByTitle("System email template preview");
    expect(frame).toHaveAttribute("sandbox", "");
  });

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
