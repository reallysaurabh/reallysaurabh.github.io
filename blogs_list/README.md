# Building an Enterprise AI Platform That Scales

A 21-post series on the architectural decisions behind building an internal AI platform for a modern, cloud-native org — written up as generalized patterns, not a case study of any one company.

This folder holds two things built from the same source content:

| Folder | Purpose |
|---|---|
| [`linkedin/`](linkedin/) | The 21 posts as plain Markdown — copy-paste ready for LinkedIn. This is the source of truth. |
| [`site/`](site/) | A generated static website (homepage + one page per post, diagrams inlined, light/dark theme). Deploy this to Vercel. Never hand-edit it — it's rebuilt from `linkedin/` by `build.js`. |

`diagrams/` holds the 19 standalone, self-contained SVG diagram pages (open any `.html` file directly in a browser — no internet required). `build.js` reads these same files and inlines their `<svg>` into the matching site post.

Suggested hashtags and social-share tags are included in each post's frontmatter and closing line.

## Building / deploying the site

```bash
cd blogs_list
npm install        # build-time only: gray-matter + marked, never shipped
node build.js       # regenerates site/ from linkedin/*.md + diagrams/*.html
npm run serve       # optional: preview site/ locally (npx serve)
```

`site/` is plain static HTML/CSS/JS with zero runtime dependencies — no server, no build step at deploy time. To deploy: point a new Vercel project at `blogs_list/site` as the root directory, framework preset **"Other"**. `site/vercel.json` (generated) enables clean URLs.

Whenever a post in `linkedin/` changes, re-run `node build.js` and redeploy — `site/` is disposable output, not something to edit by hand.

See [`PROGRESS.md`](PROGRESS.md) for the current build/verification status of the site.

## Part 0 — The Case, and the Fork

| # | Post | Diagram |
|---|------|---------|
| 1 | [Why You Need an AI Platform, Not Just AI Tools](linkedin/01-why-you-need-an-ai-platform.md) | — |
| 2 | [Google Workspace vs. Microsoft 365/Azure: How Your Identity Ecosystem Forks Your AI Platform](linkedin/02-identity-ecosystem-fork-google-vs-azure.md) | [diagram](diagrams/02-identity-ecosystem-fork.html) |

## Part 1 — Platform Foundations

| # | Post | Diagram |
|---|------|---------|
| 3 | [Why Your AI Platform Needs Environments, Not Just Endpoints](linkedin/03-environments-not-just-endpoints.md) | [diagram](diagrams/03-environment-topology.html) |
| 4 | [Don't Let Vendor Model Names Leak Into Your API](linkedin/04-dont-leak-vendor-model-names.md) | [diagram](diagrams/04-resource-id-vs-vendor-name.html) |
| 5 | [Multi-Cloud Infrastructure as Code: Foundation vs. Per-Resource Provisioning](linkedin/05-multi-cloud-iac-foundation-vs-per-resource.md) | [diagram](diagrams/05-foundation-vs-per-resource.html) |
| 6 | [Secretless Provisioning: Federated Identity for Infrastructure-as-Code](linkedin/06-secretless-provisioning-federated-identity.md) | [diagram](diagrams/06-secretless-provisioning-sequence.html) |

## Part 2 — Governance: Cost, Concurrency, Risk

| # | Post | Diagram |
|---|------|---------|
| 7 | [The Two-Layer Budget Problem: Soft Allocation vs. Hard Caps](linkedin/07-two-layer-budget-problem.md) | [diagram](diagrams/07-two-layer-budget.html) |
| 8 | [Self-Service Limits Need an Audit Trail, Not an Email Thread](linkedin/08-self-service-limits-need-audit-trail.md) | [diagram](diagrams/08-audit-trail-override-flow.html) |
| 9 | [Using Your Workflow Engine's Execution ID as a Concurrency Lock](linkedin/09-workflow-engine-execution-id-as-lock.md) | [diagram](diagrams/09-execution-id-lock-sequence.html) |
| 10 | [Computed Outputs Deserve Their Own Typed Contract](linkedin/10-computed-outputs-need-typed-contract.md) | [diagram](diagrams/10-input-vs-output-contract.html) |
| 11 | [The Security Trade-Off Ledger: Documenting Accepted Risk on Purpose](linkedin/11-security-trade-off-ledger.md) | — |

## Part 3 — Agent Runtime Architecture

| # | Post | Diagram |
|---|------|---------|
| 12 | [Identity vs. Instance: Why Your Agent's Config Shouldn't Live Inside Its Deployment](linkedin/12-identity-vs-instance-agent-config.md) | [diagram](diagrams/12-identity-vs-instance.html) |
| 13 | [Machine Identity for Autonomous Agents: No Human, No Shared Secret](linkedin/13-machine-identity-for-agents.md) | [diagram](diagrams/13-machine-identity-rotation.html) |
| 14 | [On-Behalf-Of: Letting an Agent Act as the User, Not as the Platform](linkedin/14-on-behalf-of-agent-acting-as-user.md) | [diagram](diagrams/14-on-behalf-of-flow.html) |
| 15 | [Memory Is a Resource, Not an Attribute](linkedin/15-memory-is-a-resource.md) | [diagram](diagrams/15-memory-tiers.html) |
| 16 | [Config That Changes Without a Redeploy](linkedin/16-config-without-redeploy.md) | [diagram](diagrams/16-config-baked-vs-runtime.html) |
| 17 | [Tool Servers Deserve Their Own Resource Type](linkedin/17-tool-servers-deserve-own-resource-type.md) | [diagram](diagrams/17-tool-server-resource-type.html) |

## Part 4 — Operating It at Scale

| # | Post | Diagram |
|---|------|---------|
| 18 | [The Threat Model at the Edge of an LLM Gateway](linkedin/18-threat-model-at-the-edge-of-llm-gateway.md) | [diagram](diagrams/18-llm-edge-threat-layers.html) |
| 19 | [Component-Prefixed Versioning for a Multi-Binary Platform](linkedin/19-component-prefixed-versioning.md) | [diagram](diagrams/19-component-versioning.html) |
| 20 | [Don't Bolt Observability Onto the Request Path — Fork It](linkedin/20-dont-bolt-on-observability-fork-it.md) | [diagram](diagrams/20-trace-collector-fork.html) |

## Capstone

| # | Post | Diagram |
|---|------|---------|
| 21 | [What We'd Do Differently: Patterns That Held Up and Ones That Didn't](linkedin/21-capstone-what-wed-do-differently.md) | [diagram](diagrams/21-full-platform-overview.html) |

---

*All content is genericized: no company names, no internal/proprietary tool names. Components are described by role (control plane, secrets service, workflow engine, model registry, etc.) so the patterns transfer to any org's stack.*
