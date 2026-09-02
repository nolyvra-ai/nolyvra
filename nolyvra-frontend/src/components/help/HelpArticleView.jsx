import { Box, Chip, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import HelpImage from "./HelpImage";
import HelpVideo from "./HelpVideo";
import { getCategory } from "../../content/help";

export default function HelpArticleView({ article, onBack }) {
  if (!article) {
    return (
      <Box sx={{ color: "#5A6480", fontSize: 14 }}>
        Article not found. Pick something else from the sidebar.
      </Box>
    );
  }

  const category = getCategory(article.category);

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Box
        onClick={onBack}
        sx={{ display: "inline-block", fontSize: 12.5, color: "#1D72E8", cursor: "pointer", mb: 2, fontWeight: 600 }}
      >
        ← Back to {category ? category.label : "category"}
      </Box>

      <Typography variant="h4" sx={{ mb: 1, color: "#0F1623" }}>{article.title}</Typography>

      {article.summary && (
        <Typography variant="body2" sx={{ fontSize: 15, mb: 2 }}>{article.summary}</Typography>
      )}

      {article.tags.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 3 }}>
          {article.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" sx={{ bgcolor: "#F0F4FA", color: "#5A6480", fontSize: 11 }} />
          ))}
        </Box>
      )}

      {article.hasVideo && (
        <HelpVideo src={article.video} title={article.title} aspect={article.videoAspect} />
      )}

      <Box
        sx={{
          fontSize: 14.5,
          lineHeight: 1.7,
          color: "#0F1623",
          "& h2": { fontSize: 19, fontWeight: 800, mt: 3, mb: 1 },
          "& h3": { fontSize: 16, fontWeight: 700, mt: 2.5, mb: 1 },
          "& p": { mb: 1.5 },
          "& ul, & ol": { mb: 1.5, pl: 3 },
          "& li": { mb: 0.5 },
          "& code": { bgcolor: "#F0F4FA", px: "4px", py: "1px", borderRadius: "4px", fontSize: 13 },
          "& a": { color: "#1D72E8" },
        }}
      >
        <ReactMarkdown components={{ img: HelpImage }}>{article.body}</ReactMarkdown>
      </Box>
    </Box>
  );
}
