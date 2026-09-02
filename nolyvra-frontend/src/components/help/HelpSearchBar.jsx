import { useState, useRef, useEffect } from "react";
import { Box, InputBase, Paper } from "@mui/material";
import useHelpSearch from "../../hooks/useHelpSearch";
import { helpCategories } from "../../content/help";

export default function HelpSearchBar({ onSelectArticle, sticky }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useHelpSearch(query);
  const boxRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const grouped = results.reduce((acc, article) => {
    (acc[article.category] = acc[article.category] || []).push(article);
    return acc;
  }, {});

  function categoryLabel(slug) {
    return helpCategories.find((c) => c.slug === slug)?.label || slug;
  }

  return (
    <Box
      ref={boxRef}
      sx={{
        position: "relative",
        width: "100%",
        ...(sticky ? { position: "sticky", top: 0, zIndex: 3, bgcolor: "#fff", py: 1 } : {}),
      }}
    >
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.25,
          border: "1px solid #E2E6ED",
          borderRadius: "10px",
          width: "100%",
        }}
      >
        <Box component="span" sx={{ color: "#8892A6", fontSize: 16 }}>🔍</Box>
        <InputBase
          fullWidth
          placeholder="Search the Help Center…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          sx={{ fontSize: 14 }}
        />
      </Paper>

      {open && query.trim() && (
        <Paper
          elevation={0}
          sx={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 10,
            maxHeight: 360,
            overflowY: "auto",
            border: "1px solid #E2E6ED",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(15,22,35,0.12)",
          }}
        >
          {results.length === 0 ? (
            <Box sx={{ p: 2, fontSize: 13, color: "#5A6480" }}>No articles match "{query}".</Box>
          ) : (
            Object.entries(grouped).map(([categorySlug, articles]) => (
              <Box key={categorySlug} sx={{ py: 1 }}>
                <Box sx={{ px: 2, py: 0.5, fontSize: 11, fontWeight: 700, color: "#8892A6", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {categoryLabel(categorySlug)}
                </Box>
                {articles.map((article) => (
                  <Box
                    key={article.slug}
                    onClick={() => {
                      onSelectArticle(article.category, article.slug);
                      setOpen(false);
                      setQuery("");
                    }}
                    sx={{
                      px: 2,
                      py: 1,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#F7F8FA" },
                    }}
                  >
                    <Box sx={{ fontSize: 13.5, fontWeight: 600, color: "#0F1623" }}>{article.title}</Box>
                    {article.summary && (
                      <Box sx={{ fontSize: 12, color: "#5A6480", mt: 0.25 }}>{article.summary}</Box>
                    )}
                  </Box>
                ))}
              </Box>
            ))
          )}
        </Paper>
      )}
    </Box>
  );
}
