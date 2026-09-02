import { Box, Typography } from "@mui/material";

export default function HelpArticleList({ category, onSelectArticle }) {
  if (!category) {
    return (
      <Box sx={{ color: "#5A6480", fontSize: 14 }}>
        Pick a category from the sidebar to see its articles.
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5, color: "#0F1623" }}>{category.label}</Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        {category.articles.length} article{category.articles.length === 1 ? "" : "s"}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {category.articles.map((article) => (
          <Box
            key={article.slug}
            onClick={() => onSelectArticle(category.slug, article.slug)}
            sx={{
              p: 2,
              border: "1px solid #E2E6ED",
              borderRadius: "10px",
              cursor: "pointer",
              bgcolor: "#fff",
              transition: "border-color .15s, box-shadow .15s",
              "&:hover": { borderColor: "#1D72E8", boxShadow: "0 2px 10px rgba(29,114,232,0.1)" },
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#0F1623", mb: 0.5 }}>
              {article.title}
            </Typography>
            {article.summary && (
              <Typography variant="body2" sx={{ fontSize: 13.5 }}>{article.summary}</Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
