import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminContactListBuilderPage from "./AdminContactListBuilderPage";

function renderPage() {
  return render(<MemoryRouter><AdminContactListBuilderPage /></MemoryRouter>);
}

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

const savedContact = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  company: "Acme",
  name: "Saved Contact",
  email: "saved@example.com",
  phone: "",
  role: "Manager",
  segment: "",
  source: "LinkedIn",
  owner: "John",
  stage: "Interested",
  notes: "",
  category: "Interested prospects",
  consentStatus: "Unknown",
  hasValidEmail: true,
  isDuplicate: false,
  edited: false,
  issues: [],
};

describe("AdminContactListBuilderPage access", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("loginId", "admin@example.com");
    localStorage.setItem("sessionToken", "session-token");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the tool after session-backed admin verification", async () => {
    vi.stubGlobal("fetch", vi.fn(url => String(url).endsWith("/access")
      ? jsonResponse({ admin: true })
      : jsonResponse({ fileName: "", headerRow: null, contacts: [] })));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Contact List Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload contact CSV" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/admin/access"),
      expect.objectContaining({ headers: { Authorization: "Bearer session-token" } }),
    );
  });

  it("blocks a non-admin account", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ error: "Access denied." }, false, 403)));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Administrator access is required/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Upload contact CSV" })).not.toBeInTheDocument();
  });

  it("loads saved contacts and persists page edits immediately", async () => {
    const fetchMock = vi.fn((url, options = {}) => {
      if (String(url).endsWith("/access")) return jsonResponse({ admin: true });
      if (options.method === "PATCH") {
        return jsonResponse({ ...savedContact, ...JSON.parse(options.body), name: "Updated Contact", edited: true });
      }
      return jsonResponse({
        fileName: "master.csv",
        headerRow: 2,
        contacts: [savedContact],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    expect(await screen.findByText("Saved Contact")).toBeInTheDocument();
    expect(screen.getByText("master.csv · header row 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download current list" })).toBeEnabled();
    expect(screen.queryByRole("combobox", { name: /Category for/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Updated Contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByText("Updated Contact")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/contacts/${savedContact.id}`),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("filters contacts by owner", async () => {
    const israContact = {
      ...savedContact,
      id: "223e4567-e89b-12d3-a456-426614174001",
      name: "Isra Contact",
      email: "isra@example.com",
      owner: "Isra",
    };
    vi.stubGlobal("fetch", vi.fn(url => String(url).endsWith("/access")
      ? jsonResponse({ admin: true })
      : jsonResponse({ fileName: "master.csv", headerRow: 2, contacts: [savedContact, israContact] })));
    renderPage();

    expect(await screen.findByText("Saved Contact")).toBeInTheDocument();
    expect(screen.getByText("Isra Contact")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Owner" }));
    fireEvent.click(await screen.findByRole("option", { name: "Isra" }));

    await waitFor(() => expect(screen.queryByText("Saved Contact")).not.toBeInTheDocument());
    expect(screen.getByText("Isra Contact")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Interested prospects · 1" })).toBeInTheDocument();
  });

  it("opens the editable contact table full screen and exits with Escape", async () => {
    vi.stubGlobal("fetch", vi.fn(url => String(url).endsWith("/access")
      ? jsonResponse({ admin: true })
      : jsonResponse({ fileName: "master.csv", headerRow: 2, contacts: [savedContact] })));
    renderPage();

    const enterButton = await screen.findByRole("button", { name: "View table full screen" });
    fireEvent.click(enterButton);

    expect(screen.getByRole("button", { name: "Exit full screen table" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "View table full screen" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("deselects the active category filter to show all categories", async () => {
    const currentUser = {
      ...savedContact,
      id: "323e4567-e89b-12d3-a456-426614174002",
      name: "Current User",
      email: "current@example.com",
      category: "Current users",
    };
    vi.stubGlobal("fetch", vi.fn(url => String(url).endsWith("/access")
      ? jsonResponse({ admin: true })
      : jsonResponse({ fileName: "master.csv", headerRow: 2, contacts: [savedContact, currentUser] })));
    renderPage();

    const activeFilter = await screen.findByRole("button", { name: "Interested prospects · 1" });
    expect(activeFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Current User")).not.toBeInTheDocument();

    fireEvent.click(activeFilter);

    expect(activeFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Saved Contact")).toBeInTheDocument();
    expect(screen.getByText("Current User")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "All categories contacts" })).toBeInTheDocument();
  });

  it("sorts every table field with natural ascending and descending order", async () => {
    const alphaContact = {
      ...savedContact,
      id: "423e4567-e89b-12d3-a456-426614174003",
      name: "Alpha Contact",
      email: "alpha@example.com",
    };
    vi.stubGlobal("fetch", vi.fn(url => String(url).endsWith("/access")
      ? jsonResponse({ admin: true })
      : jsonResponse({ fileName: "master.csv", headerRow: 2, contacts: [savedContact, alphaContact] })));
    renderPage();

    const sortButton = await screen.findByRole("button", { name: "Contact Name" });
    fireEvent.click(sortButton);
    let rows = screen.getByRole("table").querySelectorAll("tbody > tr");
    expect(within(rows[0]).getByText("Alpha Contact")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Saved Contact")).toBeInTheDocument();

    fireEvent.click(sortButton);
    rows = screen.getByRole("table").querySelectorAll("tbody > tr");
    expect(within(rows[0]).getByText("Saved Contact")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Alpha Contact")).toBeInTheDocument();
  });
});
