const FIELD_ALIASES = {
  company: ["company", "organisation", "organization", "employer"],
  name: ["contact name", "name", "full name", "contact"],
  phone: ["contact number", "phone", "phone number", "mobile", "telephone"],
  email: ["contact email", "email", "email address", "work email"],
  role: ["role", "job title", "title", "position"],
  segment: ["segment", "contact segment"],
  source: ["source", "lead source", "contact source"],
  owner: ["owner", "lead owner", "account owner"],
  stage: ["stage", "lifecycle stage", "status", "lead status"],
  dateAdded: ["date added", "created date", "date created"],
  lastContact: ["last contact", "last contacted", "last contact date"],
  nextActionDate: ["next action date", "next follow up", "follow up date"],
  nextStep: ["next step", "next action"],
  packageName: ["package", "plan", "product package"],
  potentialMrr: ["potential mrr ($)", "potential mrr", "mrr", "potential monthly revenue"],
  notes: ["notes", "note", "comments", "comment"],
};

const CATEGORY_RULES = [
  {
    category: "Current users",
    terms: ["active user", "current user", "customer", "client", "paid", "subscribed"],
  },
  {
    category: "Followers",
    terms: ["follower", "following", "linkedin follower", "social follower"],
  },
  {
    category: "Interested prospects",
    terms: [
      "new lead", "contacted", "demo booked", "demo", "trial", "interested",
      "follow up", "follow-up", "lost / follow up", "qualified", "prospect",
    ],
  },
];

export const CONTACT_CATEGORIES = [
  "Interested prospects",
  "Current users",
  "Followers",
  "Needs review",
];

function normaliseHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value ?? "").trim());
}

export function refreshContactQuality(contacts) {
  const refreshed = contacts.map(contact => {
    const issues = contact.issues.filter(issue => ![
      "Missing email",
      "Invalid email format",
      "Duplicate email",
      "Category needs review",
    ].includes(issue));
    const hasValidEmail = isEmail(contact.email);

    if (!contact.email) issues.push("Missing email");
    else if (!hasValidEmail) issues.push("Invalid email format");
    if (contact.category === "Needs review") issues.push("Category needs review");

    return { ...contact, hasValidEmail, isDuplicate: false, issues };
  });

  const seenEmails = new Set();
  return refreshed.map(contact => {
    if (!contact.hasValidEmail) return contact;
    const emailKey = contact.email.trim().toLowerCase();
    if (seenEmails.has(emailKey)) {
      return {
        ...contact,
        isDuplicate: true,
        issues: [...contact.issues, "Duplicate email"],
      };
    }
    seenEmails.add(emailKey);
    return contact;
  });
}

function looksLikePhone(value) {
  const text = String(value ?? "").trim();
  return text.length >= 7 && /^[+()\d\s.-]+$/.test(text);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function detectHeaderRow(rows) {
  const knownHeaders = new Set(Object.values(FIELD_ALIASES).flat());
  let best = { index: -1, score: 0 };

  rows.slice(0, 25).forEach((row, index) => {
    const score = row.reduce(
      (total, cell) => total + (knownHeaders.has(normaliseHeader(cell)) ? 1 : 0),
      0,
    );
    if (score > best.score) best = { index, score };
  });

  return best.score >= 2 ? best.index : -1;
}

function buildColumnMap(headers) {
  const positions = new Map(headers.map((header, index) => [normaliseHeader(header), index]));
  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
      field,
      aliases.map(alias => positions.get(alias)).find(index => index !== undefined) ?? -1,
    ]),
  );
}

export function classifyContact(stage, source) {
  const stageText = normaliseHeader(stage);
  const sourceText = normaliseHeader(source);

  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some(term => stageText === term || stageText.includes(term))) {
      return rule.category;
    }
  }

  if (sourceText.includes("follower")) return "Followers";
  return "Needs review";
}

export function buildContactLists(csvText) {
  const rows = parseCsv(String(csvText ?? "").replace(/^\uFEFF/, ""));
  const headerIndex = detectHeaderRow(rows);
  if (headerIndex < 0) {
    throw new Error("Could not find a contact table header. Include columns such as Contact Name, Email or Stage.");
  }

  const headers = rows[headerIndex].map(value => String(value).trim());
  const columnMap = buildColumnMap(headers);
  if (columnMap.name < 0 && columnMap.email < 0) {
    throw new Error("The file needs at least a contact name or email column.");
  }

  const contacts = rows.slice(headerIndex + 1).map((row, rowIndex) => {
    const read = field => columnMap[field] >= 0 ? String(row[columnMap[field]] ?? "").trim() : "";
    let email = read("email");
    let phone = read("phone");
    const issues = [];

    if (!isEmail(email) && isEmail(phone)) {
      const originalEmail = email;
      email = phone;
      phone = looksLikePhone(originalEmail) ? originalEmail : "";
      issues.push("Email recovered from phone column");
    }
    if (email && !isEmail(email)) issues.push("Invalid email format");
    if (!email) issues.push("Missing email");

    const stage = read("stage");
    const source = read("source");
    const category = classifyContact(stage, source);
    if (category === "Needs review") issues.push("Category needs review");

    return {
      id: `${headerIndex + rowIndex + 2}`,
      company: read("company"),
      name: read("name"),
      email,
      phone,
      role: read("role"),
      segment: read("segment"),
      source,
      owner: read("owner"),
      stage,
      dateAdded: read("dateAdded"),
      lastContact: read("lastContact"),
      nextActionDate: read("nextActionDate"),
      nextStep: read("nextStep"),
      packageName: read("packageName"),
      potentialMrr: read("potentialMrr"),
      notes: read("notes"),
      category,
      consentStatus: "Unknown",
      hasValidEmail: isEmail(email),
      issues,
    };
  }).filter(contact => Object.entries(contact).some(([key, value]) =>
    !["id", "category", "consentStatus", "hasValidEmail", "issues"].includes(key) && Boolean(value),
  ));

  return { contacts: refreshContactQuality(contacts), headers, headerRow: headerIndex + 1 };
}

export function contactsToCsv(contacts) {
  const headers = [
    "Company", "Contact Name", "Contact Number", "Contact Email", "Role", "Segment",
    "Source", "Owner", "Stage", "Date Added", "Last Contact", "Next Action Date",
    "Next Step", "Package", "Potential MRR ($)", "Notes", "Category", "Consent Status",
  ];
  const data = contacts.map(contact => [
    contact.company, contact.name, contact.phone, contact.email, contact.role, contact.segment,
    contact.source, contact.owner, contact.stage, contact.dateAdded, contact.lastContact,
    contact.nextActionDate, contact.nextStep, contact.packageName, contact.potentialMrr,
    contact.notes, contact.category, contact.consentStatus,
  ]);
  return `\uFEFF${[headers, ...data].map(row => row.map(csvCell).join(",")).join("\r\n")}`;
}
