import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

// ── Custom Quill wrapper (React-19-safe — no findDOMNode) ─────────────────────
export function QuillEditor({ value, onChange, modules, placeholder, className = "" }) {
  const wrapperRef   = useRef(null);
  const quillRef     = useRef(null);
  const onChangeRef  = useRef(onChange);
  const lastValueRef = useRef(value || "");

  // Keep callback ref up to date without re-running the init effect
  useEffect(() => { onChangeRef.current = onChange; });

  // Initialise Quill once
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || quillRef.current) return;

    // Quill inserts a toolbar sibling before the container, so we need an
    // inner div — the wrapper div collects both toolbar + container.
    const editorDiv = document.createElement("div");
    wrapper.appendChild(editorDiv);

    const quill = new Quill(editorDiv, { theme: "snow", modules, placeholder });
    quillRef.current = quill;

    if (lastValueRef.current) {
      quill.clipboard.dangerouslyPasteHTML(lastValueRef.current);
    }

    quill.on("text-change", () => {
      const html   = quill.root.innerHTML;
      const empty  = quill.getText().trim() === "";
      const emitted = empty ? "" : html;
      lastValueRef.current = emitted;
      onChangeRef.current?.(emitted);
    });

    return () => {
      quillRef.current = null;
      wrapper.innerHTML = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync value that changed externally (template load, form reset)
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastValueRef.current) return;

    if (!value) {
      quill.setContents([]);
      lastValueRef.current = "";
    } else {
      quill.clipboard.dangerouslyPasteHTML(value);
      lastValueRef.current = quill.root.innerHTML;
    }
  }, [value]);

  return <div ref={wrapperRef} className={className} />;
}
