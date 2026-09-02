import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { helpArticles } from "../content/help";

const FUSE_OPTIONS = {
  keys: [
    { name: "title", weight: 0.5 },
    { name: "summary", weight: 0.3 },
    { name: "tags", weight: 0.15 },
    { name: "body", weight: 0.05 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
};

export default function useHelpSearch(query, delay = 250) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), delay);
    return () => clearTimeout(id);
  }, [query, delay]);

  const fuse = useMemo(() => new Fuse(helpArticles, FUSE_OPTIONS), []);

  return useMemo(() => {
    const q = debounced.trim();
    if (!q) return [];
    return fuse.search(q).map((r) => r.item);
  }, [debounced, fuse]);
}
