import { HELP_CATEGORIES } from "./categories";

// Eagerly load every article's raw markdown source at build/app-start time —
// no backend endpoint, this is the whole "content model" for the Help Center.
const modules = import.meta.glob("./**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw.trim() };

  const [, frontmatter, body] = match;
  const meta = {};
  frontmatter.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    meta[key] = value;
  });
  return { meta, body: body.trim() };
}

const articles = Object.entries(modules).map(([path, raw]) => {
  const { meta, body } = parseFrontmatter(raw);
  const fileName = path.split("/").pop().replace(/\.md$/, "");
  const folderSlug = path.split("/")[1]; // "./<category>/<file>.md"
  return {
    slug: fileName,
    category: meta.category || folderSlug,
    title: meta.title || fileName,
    order: Number(meta.order) || 0,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    summary: meta.summary || "",
    hasVideo: "video" in meta,
    video: meta.video || "",
    videoAspect: meta.videoAspect || "16 / 9",
    body,
  };
});

articles.sort((a, b) => a.order - b.order);

export const helpArticles = articles;

export const helpCategories = HELP_CATEGORIES.map((cat) => ({
  ...cat,
  articles: articles.filter((a) => a.category === cat.slug),
})).filter((cat) => cat.articles.length > 0);

export function getArticle(categorySlug, articleSlug) {
  return articles.find((a) => a.category === categorySlug && a.slug === articleSlug);
}

export function getCategory(categorySlug) {
  return helpCategories.find((c) => c.slug === categorySlug);
}
