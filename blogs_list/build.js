#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = __dirname;
const LINKEDIN_DIR = path.join(ROOT, "linkedin");
const DIAGRAMS_DIR = path.join(ROOT, "diagrams");
const ASSETS_DIR = path.join(ROOT, "assets");
// The blog is published by GitHub Pages at reallysaurabh.github.io/blog/, so it
// is written straight into the repo root rather than inside blogs_list/.
const SITE_DIR = path.join(ROOT, "..", "blog");
const HOME_TEMPLATE = path.join(ROOT, "home.template.html");
const HOME_OUT = path.join(ROOT, "..", "index.html");
const HOME_MARKER = "<!-- BLOG_SECTION -->";

const SERIES_TITLE = "Building an Enterprise AI Platform That Scales";
const SERIES_DESCRIPTION =
  "Notes on the architectural decisions behind an internal AI platform for a modern, " +
  "cloud-native org — written up as generalized patterns, not a case study of one company. " +
  "Some of this held up under real scale. Some of it we'd do differently. We're sharing both.";

const PART_ORDER = ["Part 0", "Part 1", "Part 2", "Part 3", "Part 4", "Capstone"];
const PART_META = {
  "Part 0": { title: "The Case, and the Fork", hue: "var(--part-0)" },
  "Part 1": { title: "Platform Foundations", hue: "var(--part-1)" },
  "Part 2": { title: "Governance: Cost, Concurrency, Risk", hue: "var(--part-2)" },
  "Part 3": { title: "Agent Runtime Architecture", hue: "var(--part-3)" },
  "Part 4": { title: "Operating It at Scale", hue: "var(--part-4)" },
  Capstone: { title: "Capstone", hue: "var(--part-5)" },
};

marked.setOptions({ gfm: true, breaks: false });

/* ---------------------------------------------------------------- helpers */

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function partGroup(partField) {
  const match = /^(Part \d+|Capstone)/i.exec(partField || "");
  if (!match) return "Part 0";
  return match[1].replace(/^capstone$/i, "Capstone").replace(/^part/i, "Part");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* --------------------------------------------------- diagram SVG loading */

function loadDiagramSvgs() {
  const map = {};
  if (!fs.existsSync(DIAGRAMS_DIR)) return map;
  for (const file of fs.readdirSync(DIAGRAMS_DIR)) {
    if (!file.endsWith(".html")) continue;
    const html = fs.readFileSync(path.join(DIAGRAMS_DIR, file), "utf8");
    const match = html.match(/<svg[\s\S]*?<\/svg>/);
    if (match) map[file] = match[0];
  }
  return map;
}

/* ------------------------------------------------------- post processing */

function addHeadingIdsAndToc(html) {
  const toc = [];
  const withIds = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (full, inner) => {
    const plain = inner.replace(/<[^>]+>/g, "");
    const id = slugify(plain);
    toc.push({ id, text: plain });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: withIds, toc };
}

function injectDiagram(html, diagramSvgs, num) {
  // Two phrasings appear across the series:
  //   1) *Diagram: open `path` in a browser.* Description text.
  //   2) *Diagram: open `path` in a browser — description text.*
  const re = /<p><em>Diagram: open <code>([^<]+)<\/code> in a browser([\s\S]*?)<\/p>/;
  const m = html.match(re);
  if (!m) return { html, diagramFile: null };

  const rawPath = m[1].trim();
  const tail = m[2];
  let caption = "";
  const case1 = tail.match(/^\.\s*<\/em>\s*([\s\S]*)$/);
  const case2 = tail.match(/^\s*[—-]\s*([\s\S]*?)<\/em>\s*$/);
  if (case1) caption = case1[1];
  else if (case2) caption = case2[1];
  else caption = tail.replace(/<\/?em>/g, "").replace(/^[.\s—-]+/, "");
  caption = caption.trim();

  const base = path.basename(rawPath);
  const svg = diagramSvgs[base];
  if (!svg) return { html: html.replace(re, ""), diagramFile: null };
  const figure =
    `<figure class="diagram-frame">` +
    `<div class="diagram-media">${svg}</div>` +
    `<figcaption>${caption}</figcaption>` +
    `<a class="diagram-standalone-link" href="../diagrams/${base}" target="_blank" rel="noopener">Open standalone diagram ↗</a>` +
    `</figure>`;
  return { html: html.replace(re, figure), diagramFile: base };
}

/* ------------------------------------------------------------- load posts */

function loadPosts() {
  const files = fs
    .readdirSync(LINKEDIN_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const diagramSvgs = loadDiagramSvgs();

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(LINKEDIN_DIR, file), "utf8");
    const { data, content } = matter(raw);
    const slug = file.replace(/\.md$/, "");
    const num = slug.slice(0, 2);

    let bodyHtml = marked.parse(content);
    // In-body cross-references link to sibling posts by their source filename
    // (e.g. "13-machine-identity-for-agents.md"); on the generated site those
    // siblings are rendered right next to each other under site/posts/, so the
    // link just needs its extension swapped, not its path.
    bodyHtml = bodyHtml.replace(/href="(\d{2}-[a-z0-9-]+)\.md"/g, 'href="$1.html"');
    const withIds = addHeadingIdsAndToc(bodyHtml);
    bodyHtml = withIds.html;
    const diagramResult = injectDiagram(bodyHtml, diagramSvgs, num);
    bodyHtml = diagramResult.html;

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const group = partGroup(data.part);

    return {
      slug,
      num,
      title: data.title || slug,
      subtitle: data.subtitle || "",
      readTime: data.read_time || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      partField: data.part || "",
      group,
      bodyHtml,
      toc: withIds.toc,
      wordCount,
      hasDiagram: Boolean(diagramResult.diagramFile),
    };
  });
}

/* ------------------------------------------------------------- templates */

function headBlock(title, description, depth) {
  const prefix = depth === 0 ? "" : "../";
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8F%97%EF%B8%8F%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}assets/css/style.css">
<script>
  (function () {
    try {
      var t = localStorage.getItem("eap-theme");
      if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
  })();
</script>`;
}

function headerBlock(depth, backLink) {
  const prefix = depth === 0 ? "" : "../";
  return `<header class="site-header">
  <div class="container">
    <a class="brand" href="${prefix}index.html">
      <span>\u{1F3D7}️</span>
      <span>Enterprise AI Platform<span class="brand-kicker"> · field notes</span></span>
    </a>
    <div class="header-actions">
      ${backLink ? `<a class="back-link" href="${prefix}index.html">← All posts</a>` : ""}
      <a class="back-link" href="${prefix}../index.html">Saurabh Gupta</a>
      <button class="theme-toggle" data-theme-toggle type="button" aria-label="Toggle color theme">\u{1F319}</button>
    </div>
  </div>
</header>`;
}

function footerBlock() {
  return `<footer class="site-footer">
  <div class="container">
    <span>By <a href="https://reallysaurabh.github.io/">Saurabh Gupta</a> · 21 posts · self-hosted diagrams · no tracking</span>
    <span>Genericized patterns — not a case study of any one company.</span>
  </div>
</footer>`;
}

function page(depth, { title, description, bodyClass, backLink, extraHead, content, extraScripts }) {
  const prefix = depth === 0 ? "" : "../";
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headBlock(title, description, depth)}
${extraHead || ""}
</head>
<body class="${bodyClass || ""}">
${headerBlock(depth, backLink)}
${content}
${footerBlock()}
<script src="${prefix}assets/js/main.js"></script>
${extraScripts || ""}
</body>
</html>
`;
}

function renderTags(tags, cls) {
  return tags.map((t) => `<span class="${cls || "pill"}">#${escapeHtml(t)}</span>`).join("");
}

function partDot(group) {
  return `hsl(${PART_META[group].hue})`;
}

function renderIndex(posts) {
  const groups = PART_ORDER.filter((g) => posts.some((p) => p.group === g));

  const partNav = groups
    .map((g) => `<a href="#${slugify(g)}">${escapeHtml(PART_META[g].title)}</a>`)
    .join("\n");

  const sections = groups
    .map((g) => {
      const groupPosts = posts.filter((p) => p.group === g);
      const cards = groupPosts
        .map((p) => {
          const idx = PART_ORDER.indexOf(g);
          return `<article class="card" style="--part-hue: var(--part-${idx});">
  <div class="card-swatch" aria-hidden="true"></div>
  <div class="card-body">
    <span class="card-eyebrow">Post ${parseInt(p.num, 10)} of 21</span>
    <h3><a href="posts/${p.slug}.html">${escapeHtml(p.title)}</a></h3>
    <p class="card-sub">${escapeHtml(p.subtitle)}</p>
    <div class="card-footer">
      <span>${escapeHtml(p.readTime)}</span>
      <span class="card-tags">${p.tags.slice(0, 2).map((t) => `<span class="pill">${escapeHtml(t)}</span>`).join("")}</span>
    </div>
  </div>
</article>`;
        })
        .join("\n");
      const idx = PART_ORDER.indexOf(g);
      return `<section class="part-section" id="${slugify(g)}">
  <div class="container">
    <div class="part-heading">
      <span class="part-dot" style="background: var(--part-${idx});"></span>
      <h2>${escapeHtml(PART_META[g].title)}</h2>
      <span class="part-count">${groupPosts.length} post${groupPosts.length > 1 ? "s" : ""}</span>
    </div>
    <div class="card-grid">
      ${cards}
    </div>
  </div>
</section>`;
    })
    .join("\n");

  const totalWords = posts.reduce((sum, p) => sum + p.wordCount, 0);
  const readMinutes = Math.round(totalWords / 220);

  const content = `<section class="hero">
  <div class="container">
    <p class="hero-kicker">A field series</p>
    <h1>${escapeHtml(SERIES_TITLE)}</h1>
    <p>${escapeHtml(SERIES_DESCRIPTION)}</p>
    <div class="hero-meta">
      <span><strong>21</strong> posts</span>
      <span><strong>${readMinutes}</strong> min total read</span>
      <span><strong>19</strong> diagrams</span>
    </div>
    <nav class="part-nav" aria-label="Jump to part">
      ${partNav}
    </nav>
  </div>
</section>
${sections}`;

  return page(0, {
    title: SERIES_TITLE,
    description: SERIES_DESCRIPTION,
    bodyClass: "page-index",
    backLink: false,
    content,
  });
}

function renderPost(post, prev, next) {
  const idx = PART_ORDER.indexOf(post.group);
  const toc = post.toc.length
    ? `<aside class="post-toc" aria-label="On this page">
    <p class="toc-label">On this page</p>
    <ol>
      ${post.toc.map((t) => `<li><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`).join("\n      ")}
    </ol>
  </aside>`
    : `<aside class="post-toc"></aside>`;

  const pager = `<div class="post-pager">
    ${prev ? `<a class="pager-link prev" href="${prev.slug}.html"><span class="pager-direction">← Previous</span><span class="pager-title">${escapeHtml(prev.title)}</span></a>` : "<span></span>"}
    ${next ? `<a class="pager-link next" href="${next.slug}.html"><span class="pager-direction">Next →</span><span class="pager-title">${escapeHtml(next.title)}</span></a>` : "<span></span>"}
  </div>`;

  const content = `<div class="progress-bar" data-progress-bar></div>
<article class="post-shell">
  <div class="container">
    <div class="post-grid">
      <div>
        <div class="post-header" style="--part-hue: var(--part-${idx});">
          <p class="post-eyebrow">${escapeHtml(PART_META[post.group].title)} · Post ${parseInt(post.num, 10)} of 21</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="post-subtitle">${escapeHtml(post.subtitle)}</p>
          <div class="post-meta">
            <span>By <a href="../../index.html">Saurabh Gupta</a></span>
            <span>${escapeHtml(post.readTime)}</span>
            <span>${post.wordCount.toLocaleString()} words</span>
            ${post.hasDiagram ? "<span>Includes diagram</span>" : ""}
          </div>
        </div>
        <div class="post-body">
          ${post.bodyHtml}
          <div class="post-tags">${renderTags(post.tags)}</div>
        </div>
        ${pager}
      </div>
      ${toc}
    </div>
  </div>
</article>`;

  return page(1, {
    title: `${post.title} — ${SERIES_TITLE}`,
    description: post.subtitle,
    bodyClass: "page-post",
    backLink: true,
    content,
  });
}

function renderHomeBlogSection(posts) {
  const groups = PART_ORDER.filter((g) => posts.some((p) => p.group === g));
  const totalWords = posts.reduce((sum, p) => sum + p.wordCount, 0);
  const readMinutes = Math.round(totalWords / 220);
  const diagrams = posts.filter((p) => p.hasDiagram).length;

  const parts = groups
    .map((g) => {
      const idx = PART_ORDER.indexOf(g);
      const items = posts
        .filter((p) => p.group === g)
        .map(
          (p) => `<li><a href="blog/posts/${p.slug}.html" title="${escapeHtml(p.subtitle)}">
            <span class="post-num">${p.num}</span>
            <span class="post-title">${escapeHtml(p.title)}</span>
            <span class="post-time">${escapeHtml(p.readTime)}</span>
          </a></li>`
        )
        .join("\n          ");
      return `<div class="series-part">
        <h4><span class="part-dot" style="background: hsl(var(--part-${idx}));"></span>${escapeHtml(PART_META[g].title)}</h4>
        <ol>
          ${items}
        </ol>
      </div>`;
    })
    .join("\n      ");

  return `<section class="home-section" id="writing">
  <div class="container">
    <div class="section-heading">
      <h2>Writing</h2>
      <p>Long-form notes on building AI platforms.</p>
    </div>
    <div class="series-banner">
      <div class="series-banner-top">
        <p class="hero-kicker">A ${posts.length}-part field series</p>
        <h3><a href="blog/index.html">${escapeHtml(SERIES_TITLE)}</a></h3>
        <p>${escapeHtml(SERIES_DESCRIPTION)}</p>
        <div class="hero-meta">
          <span><strong>${posts.length}</strong> posts</span>
          <span><strong>${readMinutes}</strong> min total read</span>
          <span><strong>${diagrams}</strong> diagrams</span>
        </div>
        <div class="home-cta">
          <a class="btn btn-primary" href="blog/posts/${posts[0].slug}.html">Start with post 1</a>
          <a class="btn" href="blog/index.html">Browse the series</a>
        </div>
      </div>
      <div class="series-parts">
      ${parts}
      </div>
    </div>
  </div>
</section>`;
}

/* --------------------------------------------------------------- build */

function build() {
  rimraf(SITE_DIR);
  ensureDir(SITE_DIR);
  ensureDir(path.join(SITE_DIR, "posts"));
  ensureDir(path.join(SITE_DIR, "diagrams"));

  copyRecursive(ASSETS_DIR, path.join(SITE_DIR, "assets"));
  if (fs.existsSync(DIAGRAMS_DIR)) copyRecursive(DIAGRAMS_DIR, path.join(SITE_DIR, "diagrams"));

  const posts = loadPosts();

  fs.writeFileSync(path.join(SITE_DIR, "index.html"), renderIndex(posts));

  posts.forEach((post, i) => {
    const prev = i > 0 ? posts[i - 1] : null;
    const next = i < posts.length - 1 ? posts[i + 1] : null;
    fs.writeFileSync(path.join(SITE_DIR, "posts", `${post.slug}.html`), renderPost(post, prev, next));
  });

  const template = fs.readFileSync(HOME_TEMPLATE, "utf8");
  if (!template.includes(HOME_MARKER)) throw new Error(`${HOME_TEMPLATE} is missing ${HOME_MARKER}`);
  fs.writeFileSync(HOME_OUT, template.replace(HOME_MARKER, renderHomeBlogSection(posts)));

  console.log(`Built ${posts.length} posts + 1 index into ${path.relative(ROOT, SITE_DIR)}/`);
  console.log(`Wrote homepage to ${path.relative(ROOT, HOME_OUT)}`);
  const withDiagram = posts.filter((p) => p.hasDiagram).length;
  console.log(`${withDiagram} posts have an inlined diagram.`);
}

build();
