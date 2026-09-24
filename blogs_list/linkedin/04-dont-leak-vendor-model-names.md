---
title: "Don't Let Vendor Model Names Leak Into Your API"
subtitle: "Somewhere, a model provider is about to rename a string you've been treating as a permanent identifier. This is your warning."
series: "Building an Enterprise AI Platform That Scales"
part: "Part 1, post 4 of 21"
read_time: "7 min read"
tags: ["EnterpriseAI", "AIPlatform", "APIDesign", "SoftwareArchitecture", "PlatformEngineering", "MLOps", "MultiCloud"]
---

Every model provider's naming scheme is, from the outside, someone else's internal decision that you don't get a vote on. That's fine, right up until you've built your API contract on top of it.

This is a short one, because the idea is simple even though the consequences of skipping it aren't: whatever identifier your platform's consumers use to reference "the model I want to call," it should be *yours* — a resource ID you mint and control — not the literal string the vendor happens to be calling that model this quarter.

## The coupling trap

Here's how it happens, innocently enough. Your platform needs to let a team register "we want to use provider X's flagship model." The fastest way to do that is to store the vendor's own model string — something like a specific deployment name — as the identifier, and let every consumer reference the model by that same string. It works. It ships fast. Everyone moves on.

Then one of a few entirely predictable things happens:

- The vendor renames or restructures the string — a new version suffix, a deprecated naming convention, a model that used to be one SKU and is now split into regional variants.
- You want to run the same logical model across two regions, or even two providers, for redundancy or cost reasons — and now "the model" needs to mean more than one underlying vendor string simultaneously.
- The vendor deprecates the exact string you exposed, on their timeline, not yours, and now every consumer of your API — who thinks they're calling a stable identifier you own — breaks in lockstep, on a schedule you didn't choose.

None of these are exotic edge cases. They're closer to "things that will definitely happen if you run this platform long enough." The question isn't whether a vendor will eventually reshuffle their naming — it's whether your API contract felt that reshuffle or was insulated from it.

## A small, hypothetical example

Imagine a scaling healthtech company registers a model under the vendor's own identifier — something like `provider-model-v2-preview` — because that's what showed up in the vendor's docs and it was the path of least resistance. A dozen internal services start calling it by that exact string.

Eight months later, the vendor promotes the preview to general availability and renames it. The old preview string still technically works for a grace period, then stops. Every one of those dozen services now needs a coordinated update, on a deadline set by someone else's release calendar, discovered mostly through failed requests rather than a heads-up. Compare that to: the platform had assigned its own resource ID, say `healthtech-summarizer-v1`, and one row in the model registry gets repointed to the new vendor string behind the scenes. Nothing downstream even notices.

*Diagram: open `diagrams/04-resource-id-vs-vendor-name.html` in a browser.* It's a simple before/after — the "coupled" shape where every consumer holds the vendor's raw string directly, versus the "decoupled" shape where consumers hold your resource ID and only the registry itself knows the vendor's current string.

## What this buys you, concretely

- **Multi-region and multi-vendor become non-events.** Your resource ID can point at different underlying vendor deployments in different regions, or even fail over between vendors, without anyone downstream needing to know or care.
- **Vendor deprecations become a registry update, not an incident.** You repoint one row; consumers keep calling the same identifier they always have.
- **Your API surface actually belongs to you.** You can document, version, and evolve a resource ID on your own terms. You can't do any of that for a string someone else's product team owns.

## The one place we've gone back and forth

Where we're genuinely less certain: how much of the vendor's own versioning semantics to surface *through* your resource ID versus hide entirely. Fully hiding it is the purest version of the pattern, but it means a consumer can't tell "am I on the newest capable model" without asking your registry a separate question. We've landed on exposing a coarse version marker on our own resource ID (a `v1`, `v2` on *our* identifier, bumped when we choose to, not when the vendor does) rather than the vendor's raw version string — but we wouldn't call this settled, and if you've found a cleaner way to give consumers visibility without recoupling them to the vendor's naming, that's a trade-off worth comparing notes on.

This is a small pattern with an outsized payoff, and it's one of the cheapest things to get right early — which is exactly why [the capstone](21-capstone-what-wed-do-differently.md) later in this series flags it as a "do this on day one" item.

Next: [post 5](05-multi-cloud-iac-foundation-vs-per-resource.md), on a related decoupling problem one layer down — separating the infrastructure that's shared and long-lived from the infrastructure that's provisioned and torn down per resource.

**Suggested hashtags:** #EnterpriseAI #AIPlatform #APIDesign #SoftwareArchitecture #PlatformEngineering #MLOps #MultiCloud #TechDebt #AIInfrastructure
