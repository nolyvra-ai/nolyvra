import { Box } from "@mui/material";
import { helpCategories } from "../../content/help";

const ACCENT = "#1D72E8";
const PURPLE = "#7C3AED";

export default function HelpSidebar({ activeCategory, activeArticle, onSelectCategory, onSelectArticle, expanded, onToggleExpanded }) {
  return (
    <Box component="nav" sx={{ width: "100%" }}>
      {helpCategories.map((cat) => {
        const isOpen = expanded.has(cat.slug);
        const isActiveCategory = activeCategory === cat.slug;
        const isCrmx = cat.slug === "crmx";

        return (
          <Box key={cat.slug} sx={{ mb: 0.5 }}>
            <Box
              onClick={() => {
                onToggleExpanded(cat.slug);
                onSelectCategory(cat.slug);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: "12px",
                py: "9px",
                borderRadius: "8px",
                cursor: "pointer",
                userSelect: "none",
                fontSize: 13.5,
                fontWeight: isActiveCategory ? 700 : 600,
                color: isActiveCategory ? (isCrmx ? PURPLE : ACCENT) : "#0F1623",
                bgcolor: isActiveCategory ? (isCrmx ? "rgba(124,58,237,0.08)" : "rgba(29,114,232,0.08)") : "transparent",
                "&:hover": { bgcolor: isActiveCategory ? undefined : "#F7F8FA" },
              }}
            >
              <span>{cat.label}</span>
              <Box component="span" sx={{ fontSize: 10, color: "#8892A6", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                ▸
              </Box>
            </Box>

            {isOpen && (
              <Box sx={{ pl: "12px", borderLeft: "1px solid #E2E6ED", ml: "16px", mt: "2px" }}>
                {cat.articles.map((article) => {
                  const isActiveArticle = isActiveCategory && activeArticle === article.slug;
                  return (
                    <Box
                      key={article.slug}
                      onClick={() => onSelectArticle(cat.slug, article.slug)}
                      sx={{
                        px: "12px",
                        py: "6px",
                        fontSize: 12.5,
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: isActiveArticle ? "#0F1623" : "#5A6480",
                        fontWeight: isActiveArticle ? 700 : 500,
                        bgcolor: isActiveArticle ? "#F0F4FA" : "transparent",
                        "&:hover": { bgcolor: "#F7F8FA", color: "#0F1623" },
                      }}
                    >
                      {article.title}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
