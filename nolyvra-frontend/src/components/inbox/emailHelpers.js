const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", SURFACE = "#FAFBFD";

// ── Quill toolbar config (defined outside so refs are stable) ─────────────────
export const BODY_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ["small", false, "large", "huge"] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};
export const SIG_MODULES = {
  toolbar: [["bold", "italic", "underline"], ["link"], ["clean"]],
};

// ── Quill CSS injected once into <head> ───────────────────────────────────────
const STYLE_ID = "nolyvra-quill-theme";
export function injectQuillStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    /* ── body editor ── */
    .nolyvra-quill .ql-toolbar.ql-snow {
      border: 1px solid ${BORDER}; border-radius: 8px 8px 0 0;
      background: ${SURFACE}; padding: 6px 10px;
    }
    .nolyvra-quill .ql-container.ql-snow {
      border: 1px solid ${BORDER}; border-top: none;
      border-radius: 0 0 8px 8px; font-family: inherit; font-size: 13px;
    }
    .nolyvra-quill .ql-editor { min-height: 220px; font-size: 13px; color: ${TEXT}; line-height: 1.65; }
    .nolyvra-quill .ql-editor.ql-blank::before { color: ${MUTED}; font-style: normal; font-size: 12px; }

    /* ── compact body editor (reply composer) ── */
    .nolyvra-quill-compact .ql-toolbar.ql-snow {
      border: 1px solid ${BORDER}; border-radius: 8px 8px 0 0;
      background: ${SURFACE}; padding: 5px 8px;
    }
    .nolyvra-quill-compact .ql-container.ql-snow {
      border: 1px solid ${BORDER}; border-top: none;
      border-radius: 0 0 8px 8px; font-family: inherit; font-size: 13px;
    }
    .nolyvra-quill-compact .ql-editor { min-height: 110px; font-size: 13px; color: ${TEXT}; line-height: 1.6; }
    .nolyvra-quill-compact .ql-editor.ql-blank::before { color: ${MUTED}; font-style: normal; font-size: 12px; }

    /* ── signature editor ── */
    .nolyvra-quill-sig .ql-toolbar.ql-snow {
      border: 1px solid ${BORDER}; border-radius: 8px 8px 0 0;
      background: ${SURFACE}; padding: 4px 8px;
    }
    .nolyvra-quill-sig .ql-container.ql-snow {
      border: 1px solid ${BORDER}; border-top: none;
      border-radius: 0 0 8px 8px; font-size: 12px;
    }
    .nolyvra-quill-sig .ql-editor { min-height: 64px; font-size: 12px; color: ${MUTED}; line-height: 1.55; }
    .nolyvra-quill-sig .ql-editor.ql-blank::before { color: #C4C9D4; font-style: normal; font-size: 12px; }
  `;
  document.head.appendChild(s);
}

export function textToHtml(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text; // already HTML
  return text
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function buildBodyWithSig(body, sigHtml) {
  if (!sigHtml || sigHtml === "<p><br></p>") return body;
  const sigText = sigHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  if (!sigText) return body;
  const sigBlock = `<br><hr style="border:none;border-top:1px solid #E8ECF2;margin:12px 0"><div style="color:#6B7280;font-size:12px">${sigHtml}</div>`;
  return body + sigBlock;
}
