---
title: "Tool Servers Deserve Their Own Resource Type"
subtitle: "It's not an agent that happens to expose tools. It's infrastructure wearing a disguise."
series: "Building an Enterprise AI Platform That Scales"
part: "Part 3, post 17 of 21"
read_time: "7 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "MCP", "AIAgents", "APIDesign"]
---

Open your platform's resource list and try to answer, at a glance, which "agents" are actually agents — things that reason, decide, take autonomous action — and which are really just tool servers wearing an agent costume because that's the only resource type your data model happened to have when someone needed to expose a set of functions to multiple other agents.

If you can't tell without opening five of them and reading their configs, this post is for you.

## How the Tangle Happens

It starts innocently. Someone builds an agent that does a thing, and that thing turns out to be useful to other agents too — a search function, a database lookup, a call to some internal API. Rather than build new infrastructure, the fastest path is: expose that functionality from the existing agent, over a protocol other agents can call into (an MCP-style tool interface, say). It works. It ships.

Six months later, that "agent" is actually load-bearing infrastructure that a dozen other agents depend on for a tool they can't function without. But it still lives in your data model as an agent — with an agent's lifecycle, an agent's permission model, an agent's expectations about autonomy and decision-making — none of which actually describe what it is anymore.

This is where things get genuinely confusing, not just aesthetically messy:

- **Lifecycle mismatch.** Agents get redeployed, experimented on, sometimes torn down when a project ends. A tool server that a dozen *other* agents depend on cannot tolerate that same casual lifecycle — but nothing in your data model distinguishes "agent nobody else depends on, tear down freely" from "agent that is secretly shared infrastructure, touch with extreme care."
- **Permission mismatch.** An agent's permission model is usually about what *it* is allowed to do. A tool server's permission model needs to be about who's allowed to *call it* and what capabilities it exposes to each caller — a fundamentally different question that an agent-shaped resource often has no clean way to express.
- **Ownership confusion.** Who's on call when the "agent" goes down? The team that built it as a convenience three months ago, who now discover — usually during an incident — that they're operating shared infrastructure they never signed up to run at that level of reliability.

## Give It Its Own Resource Type

The fix is to stop letting a tool server borrow an agent's clothing. Model it as its own first-class resource type — call it a tool server, an MCP server, whatever fits your platform's vocabulary — with:

- **Its own lifecycle**, reflecting that it's shared infrastructure: more deliberate deployment, more caution around teardown, versioning that other agents' dependencies can pin against.
- **Its own permission model**, scoped to who can call which exposed capability, independent of any individual agent's permissions.
- **Its own place in the resource list**, so anyone looking at the platform can immediately tell "this is a tool server twelve agents depend on" from "this is an agent one team is experimenting with" — without opening a single config file.

*Diagram: open `diagrams/17-tool-server-resource-type.html` in a browser.* It contrasts the anti-pattern — a tool server hiding inside one agent's config, with dependents nobody can see — against the first-class version, where multiple agents share one tool server resource with its own lifecycle and permissions.

This isn't a purity exercise. It's the same principle that runs through this whole series: model what a thing *actually is*, not what was fastest to build the day someone first needed it. An agent and a tool server are genuinely different kinds of resource — different lifecycles, different failure modes, different stakeholders — and pretending otherwise doesn't save you work, it just defers the confusion to whoever's on call the day the disguise falls off.

## A Small, Concrete Example

Consider a platform team at a mid-sized insurer that built an agent to look up policy details from an internal system, purely to support one claims-processing agent. It worked well enough that three other teams started calling it too — a fraud-detection agent, a customer-service agent, a renewals agent. Nobody made a decision to turn it into shared infrastructure; it just happened, one dependency at a time.

Then the original team wants to redeploy it with a new set of permissions scoped to *their* use case — a perfectly reasonable thing to do to "their agent." Three other teams' agents break, because nobody had a way to see, before making that change, that this "agent" was actually load-bearing for a quarter of the platform's active workflows. Modeled as a tool server from the start, that dependency would have been visible in the resource graph the moment the second team started calling it — not discovered retroactively via an incident channel.

## Where We're Not Fully Decided

The genuinely hard part, for us, is deciding *when* a tool crosses the line from "single-consumer, fine as-is" to "shared infrastructure, promote it." We don't have a clean threshold — we've used "a second team started depending on it" as a rough trigger, but that's reactive by nature, and reactive is exactly what let the insurer scenario happen in the first place. If anyone has a good leading indicator for "this is about to become shared infrastructure" rather than a trailing one, we'd love to steal it.

## A Few Things We'd Watch For

We'd be wary of over-correcting into ceremony for genuinely small, single-consumer tools — not every function an agent exposes needs the full weight of a shared-infrastructure resource type, and forcing consistency for its own sake adds process without adding much safety.

We'd also want to make sure a tool server's permission model doesn't quietly become a rubber stamp. "Any agent can call any tool" undercuts the reason for separating the resource type in the first place — the point was to make caller-scoped permissions expressible, so it's worth actually expressing them.

And having the right resource type doesn't automatically buy dependency visibility — the platform still needs to record and surface "which agents call this tool server," or the insurer scenario above can repeat itself even with otherwise clean modeling.

That's roughly how we ended up thinking about agent runtime architecture — identity, machine credentials, on-behalf-of access, memory, runtime config, and now tool servers, each earning its own resource rather than being crammed into whatever shape shipped fastest. None of it felt obvious in advance, and we're still adjusting pieces of it. Part 4 turns from *how agents are built* to *how the platform stays safe and legible while running them* — starting with the threat model at the edge of an LLM gateway. If your platform drew any of these lines differently, we'd genuinely like to hear about it.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #MCP #AIAgents #APIDesign
