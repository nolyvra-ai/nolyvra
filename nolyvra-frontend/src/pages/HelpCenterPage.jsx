import { useEffect, useMemo, useState } from "react";
import { Box, Drawer, Typography, useMediaQuery } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import HelpSidebar from "../components/help/HelpSidebar";
import HelpSearchBar from "../components/help/HelpSearchBar";
import HelpArticleList from "../components/help/HelpArticleList";
import HelpArticleView from "../components/help/HelpArticleView";
import { helpCategories, getArticle, getCategory } from "../content/help";

export default function HelpCenterPage() {
  const isMobile = useMediaQuery("(max-width:768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const categorySlug = searchParams.get("category") || helpCategories[0]?.slug || "";
  const articleSlug = searchParams.get("article") || "";

  const [expanded, setExpanded] = useState(() => new Set(categorySlug ? [categorySlug] : []));

  useEffect(() => {
    if (categorySlug) setExpanded((prev) => new Set(prev).add(categorySlug));
  }, [categorySlug]);

  const activeCategory = useMemo(() => getCategory(categorySlug), [categorySlug]);
  const activeArticle = useMemo(
    () => (articleSlug ? getArticle(categorySlug, articleSlug) : null),
    [categorySlug, articleSlug]
  );

  function selectCategory(slug) {
    setSearchParams({ category: slug });
  }

  function selectArticle(catSlug, artSlug) {
    setSearchParams({ category: catSlug, article: artSlug });
    setDrawerOpen(false);
  }

  function toggleExpanded(slug) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const sidebarContent = (
    <HelpSidebar
      activeCategory={categorySlug}
      activeArticle={articleSlug}
      onSelectCategory={selectCategory}
      onSelectArticle={selectArticle}
      expanded={expanded}
      onToggleExpanded={toggleExpanded}
    />
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5, color: "#0F1623" }}>Help Center</Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        Guides for every part of Nolyvra — search, or browse by category.
      </Typography>

      <Box sx={{ mb: 3, position: isMobile ? "sticky" : "static", top: 0, zIndex: 4, bgcolor: "#F7F8FA", pt: isMobile ? 1 : 0, pb: isMobile ? 1 : 0 }}>
        <HelpSearchBar onSelectArticle={selectArticle} />
      </Box>

      {isMobile && (
        <Box
          onClick={() => setDrawerOpen(true)}
          sx={{
            display: "inline-flex", alignItems: "center", gap: 1, mb: 2,
            px: 2, py: 1, border: "1px solid #E2E6ED", borderRadius: "8px",
            fontSize: 13, fontWeight: 600, color: "#0F1623", cursor: "pointer",
          }}
        >
          ☰ Browse categories
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
        {!isMobile && (
          <Box sx={{ width: 260, flexShrink: 0, position: "sticky", top: 16 }}>
            {sidebarContent}
          </Box>
        )}

        {isMobile && (
          <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <Box sx={{ width: 280, p: 2 }}>{sidebarContent}</Box>
          </Drawer>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {activeArticle ? (
            <HelpArticleView article={activeArticle} onBack={() => setSearchParams({ category: categorySlug })} />
          ) : (
            <HelpArticleList category={activeCategory} onSelectArticle={selectArticle} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
