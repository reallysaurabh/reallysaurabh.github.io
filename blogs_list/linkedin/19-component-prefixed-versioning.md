---
title: "Component-Prefixed Versioning for a Multi-Binary Platform"
subtitle: "What's actually running in production shouldn't require an archaeology degree"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 4, post 19 of 21"
read_time: "8 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "PlatformEngineering", "DevOps", "ReleaseEngineering", "SemVer", "CICD", "Monorepo"]
---

Ask an operator what version of the API server is running in production, and if the honest answer is "let me check which commit SHA is in the deployment manifest and cross-reference it against the changelog," you don't have a versioning scheme. You have a scavenger hunt, and the prize is finding out whether last Tuesday's bug is still there.

This is one of the smaller, less glamorous decisions in the whole series — nobody writes a conference talk titled "How We Tag Our Releases" — but it's one we'd genuinely put near the top of the list of things worth getting right early, because the cost of getting it wrong compounds quietly for years.

## The problem: one repo, several things that ship independently

A platform like the one we've been describing across this series rarely ships as a single binary. There's a CLI developers install locally. There's a control plane that gets deployed to a cluster. There's often a proxy or gateway component sitting in the request path. These live in the same monorepo — sensible, since they share types, share tooling, share a review process — but they absolutely do not ship on the same schedule. A CLI fix shouldn't force a control-plane redeploy. A control-plane hotfix shouldn't force everyone to reinstall the CLI.

Plain semantic versioning (`v2.3.1`) works beautifully when there's one thing to version. The moment there are three independently-releasable components sharing a repo, a bare `v2.3.1` tag becomes a question instead of an answer: version 2.3.1 of *what*, exactly?

## What we landed on: prefix the component into the tag

The fix we've used is boring in the best way — prefix the semver tag with the component name: `cli-v2.3.0`, `controlplane-v1.14.2`, `proxy-v0.9.4`. Each component gets its own independent version lineage, bumped only when *that* component changes, tagged and released through its own pipeline trigger.

*Diagram: open `diagrams/19-component-versioning.html` in a browser — it shows the monorepo containing three components, each with an independent version-tag timeline, converging into a release pipeline that produces immutable, individually-versioned artifacts.*

The part that actually pays off isn't the naming convention itself — it's what it enables downstream:

- **"What's running in prod" becomes a real, greppable string**, not a commit SHA someone has to look up in a spreadsheet nobody maintains past the first quarter.
- **Rollback becomes "redeploy `controlplane-v1.14.1`,"** a sentence a human can say out loud in an incident channel, rather than "redeploy the commit from before the bad one, which was... hang on."
- **Release notes attach to something meaningful.** "What changed in `cli-v2.3.0`" is an answerable question. "What changed since yesterday" is not, once three components are shipping on independent cadences.
- **Compliance and audit conversations get a lot shorter.** "Which version of the control plane processed this request on this date" turning into an actual lookup instead of a forensic reconstruction is worth more than it sounds like on paper.

We don't think this is the only workable scheme — some teams we've talked to prefer separate repos per component specifically to avoid this problem, and that's a legitimate trade-off too (you get clean independent versioning for free, at the cost of the shared-tooling convenience a monorepo gives you). We've stayed with prefixed tags in a monorepo because the shared-code benefits outweighed the versioning awkwardness for us, but we'd be lying if we said this was obviously correct rather than "the trade-off we were willing to make."

## The other half: making developer builds unmistakably not-production

Prefixed release tags solve "what's a real release." They don't automatically solve the adjacent problem: developers build and run this stuff constantly during normal work, and some of those artifacts get pushed somewhere for testing, sharing, or debugging. If a developer's ad-hoc build of the control plane can end up looking, in a registry or artifact list, indistinguishable from an actual release candidate, you've built a trap that's waiting for a tired engineer on a Friday afternoon.

The fix here is naming discipline as a safety mechanism rather than a cosmetic one: ad-hoc builds get an unmistakable, unpromotable suffix — `controlplane-v1.14.2-dev.a1b2c3`, or a clearly separate channel/registry path entirely. The goal isn't just readability. It's that nobody — not a script, not a human skimming a list at 6 p.m. — can mistake a snapshot build for a release candidate and promote it by mistake. A little redundancy in the naming (component *and* channel *and*, ideally, a build identifier) is cheap insurance against a very expensive kind of mistake.

## A small, hypothetical example

Picture a platform with the three components above, and an on-call engineer paged at 1 a.m. because the control plane is throwing errors after a deploy twenty minutes earlier. With component-prefixed tags, the incident channel message is: "rolling back to `controlplane-v1.14.1`, redeploying now." Without them, the message is: "trying to figure out what commit was deployed twenty minutes ago, one second." Both engineers fix the problem eventually. Only one of them gets back to sleep at a reasonable hour.

## Pitfalls

- **Letting the tagging scheme be a suggestion rather than a pipeline gate.** If a human can push a differently-shaped tag and have it accepted, eventually one will, usually under deadline pressure, usually right before the incident that makes you wish you'd enforced it.
- **Forgetting that shared code needs its own versioning story.** If the CLI, control plane, and proxy share an internal library, that library's changes ripple across component version bumps in ways that aren't always obvious from the tag alone — worth documenting, not worth over-engineering.
- **Treating this as solved once the scheme is written down.** The value is entirely in enforcement — a tag naming convention nobody's pipeline actually checks is just a really specific suggestion.
- **Over-indexing on the scheme and under-indexing on the "why."** The naming convention is the boring part. The reason it matters — being able to answer "what's running, and can I safely roll it back" without opening three other tools — is the part worth actually caring about.

If you've solved this differently — separate repos, a single unified version across all components, something else entirely — we'd genuinely like to know how it's held up, because we suspect there's more than one reasonable answer here and we've only tried one of them at scale.

Next up: **"Don't Bolt Observability Onto the Request Path — Fork It"** — because the same instinct toward "know what's actually happening" applies just as much to telemetry as it does to release tags.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #PlatformEngineering #DevOps #ReleaseEngineering #SemVer #CICD #Monorepo
