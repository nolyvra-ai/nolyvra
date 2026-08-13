import { describe, expect, it } from "vitest";
import {
  buildContactLists,
  classifyContact,
  contactsToCsv,
  detectHeaderRow,
  parseCsv,
  refreshContactQuality,
} from "./contactListBuilder";

describe("contact list builder utilities", () => {
  it("parses quoted CSV cells and detects a header below title rows", () => {
    const rows = parseCsv('Sales Tracker,,,,\r\n"One row, per lead",,,,\r\n,,,,\r\nCompany,Contact Name,Contact Email,Stage\r\nAcme,"Doe, Jane",jane@example.com,Contacted');

    expect(rows[1][0]).toBe("One row, per lead");
    expect(detectHeaderRow(rows)).toBe(3);
  });

  it("recovers swapped email and phone fields without guessing blank stages", () => {
    const csv = [
      "Sales Tracker,,,,",
      ",,,,",
      "Company,Contact Name,Contact Number,Contact Email,Source,Stage,Date Added,Last Contact,Next Action Date,Next Step,Package,Potential MRR ($)",
      "Nuage,Barry Smith,barry@example.com,0414 211 491,LinkedIn,,27.05.26,28.05.26,30.05.26,Book demo,Growth ($199),$199",
      "Acme,Jane Doe,,jane@example.com,LinkedIn,Contacted,,,,,,",
    ].join("\n");

    const { contacts, headerRow } = buildContactLists(csv);

    expect(headerRow).toBe(3);
    expect(contacts[0]).toMatchObject({
      email: "barry@example.com",
      phone: "0414 211 491",
      category: "Needs review",
      hasValidEmail: true,
      dateAdded: "27.05.26",
      lastContact: "28.05.26",
      nextActionDate: "30.05.26",
      nextStep: "Book demo",
      packageName: "Growth ($199)",
      potentialMrr: "$199",
    });
    expect(contacts[0].issues).toContain("Email recovered from phone column");
    expect(contacts[1].category).toBe("Interested prospects");
  });

  it("classifies only explicit user and follower signals", () => {
    expect(classifyContact("Active User", "Website")).toBe("Current users");
    expect(classifyContact("", "LinkedIn follower export")).toBe("Followers");
    expect(classifyContact("", "LinkedIn")).toBe("Needs review");
  });

  it("exports contact fields without internal quality metadata", () => {
    const output = contactsToCsv([{
      category: "Interested prospects",
      name: "Doe, Jane",
      email: "jane@example.com",
      phone: "",
      company: "Acme",
      role: "Recruiter",
      segment: "Agency",
      source: "LinkedIn",
      owner: "Gabby",
      stage: "Contacted",
      dateAdded: "2026-05-27",
      lastContact: "2026-05-28",
      nextActionDate: "2026-06-01",
      nextStep: "Book demo",
      packageName: "Growth ($199)",
      potentialMrr: "$199",
      consentStatus: "Unknown",
      issues: ["Consent needs review"],
      notes: "Warm lead",
    }]);

    expect(output).toContain('"Doe, Jane"');
    expect(output).toContain("Consent Status");
    expect(output).toContain("Unknown");
    expect(output).toContain("Date Added");
    expect(output).toContain("2026-06-01");
    expect(output).toContain("Potential MRR ($)");
    expect(output).not.toContain("Data Quality Issues");
    expect(output).not.toContain("Consent needs review");
  });

  it("revalidates edited emails and recalculates duplicates", () => {
    const refreshed = refreshContactQuality([
      { id: "1", email: "same@example.com", category: "Interested prospects", issues: ["Missing email"] },
      { id: "2", email: "same@example.com", category: "Needs review", issues: [] },
      { id: "3", email: "not-an-email", category: "Current users", issues: [] },
    ]);

    expect(refreshed[0]).toMatchObject({ hasValidEmail: true, isDuplicate: false });
    expect(refreshed[0].issues).not.toContain("Missing email");
    expect(refreshed[1]).toMatchObject({ hasValidEmail: true, isDuplicate: true });
    expect(refreshed[1].issues).toEqual(expect.arrayContaining(["Duplicate email", "Category needs review"]));
    expect(refreshed[2].issues).toContain("Invalid email format");
  });
});
