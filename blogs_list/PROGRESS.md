# Build & Verification Status

Last verified: 2026-09-24.

## Content

- 21/21 posts written in `linkedin/*.md`, ~25,000 words total.
- All 21 have complete frontmatter (`title`, `subtitle`, `series`, `part`, `read_time`, `tags`).
- 19/21 posts have a matching diagram in `diagrams/` (posts 1 and 11 are intentionally diagram-free).
- No leftover `TODO`/`FIXME`/placeholder markers in `linkedin/` or `diagrams/`.
- Scanned for leaked internal names — only generic, expected vendor/tool references remain
  (Azure Key Vault, Google Secret Manager, HashiCorp Vault, Temporal), each used illustratively
  as the posts themselves frame them ("Temporal, Step Functions, whatever your stack uses").
  No proprietary company or internal tool names found.

## Site build

- `node build.js` runs clean: **21 posts + 1 index** generated into `site/`, **19 posts** report
  an inlined diagram (matches the 19 diagram files).
- All internal `href`/`src` references across every generated `.html` file (index, posts,
  diagrams, assets) resolve to a real file — verified with a full link-existence scan, zero
  missing targets.
- `site/vercel.json` present (`cleanUrls: true`, `trailingSlash: false`).

## Not yet done

- Not deployed to Vercel — no live project created yet.
- No visual/browser QA pass (link + build integrity verified programmatically; rendering,
  theme toggle, and responsive layout not eyeballed in a browser).
- `blogs_list/` is fully untracked in git — nothing has been committed.
