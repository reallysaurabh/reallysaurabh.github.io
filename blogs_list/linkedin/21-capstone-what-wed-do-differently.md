---
title: "What We'd Do Differently: Patterns That Held Up and Ones That Didn't"
subtitle: "A retrospective, not a victory lap"
series: "Building an Enterprise AI Platform That Scales"
part: "Capstone, post 21 of 21"
read_time: "13 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "AIStrategy", "TechLeadership", "ArchitectureRetrospective", "SystemDesign", "AgentArchitecture", "CTO", "EngineeringCulture", "LessonsLearned"]
---

If you've read this whole series, you've now sat through twenty posts about environments, budgets, identity, agent memory, edge security, and versioning — which is a lot of opinions from people who, we'll say plainly, do not have this fully figured out. This last post is the one where we stop presenting decisions as though they arrived fully formed, and admit what they actually were: a series of trade-offs made under real constraints, some of which we'd make again immediately, and a few we'd genuinely reconsider.

## The shape of the series, briefly

Four arcs, in case you're joining at the end (we won't judge):

- **Part 0 — The Case & The Fork.** Why an org needs a platform rather than a pile of point tools, and why your identity ecosystem (Google Workspace vs. Microsoft/Azure, or something else entirely) forks nearly every architectural decision that follows.
- **Part 1 — Platform Foundations.** Environments, model registries, multi-cloud provisioning, and secretless infrastructure-as-code.
- **Part 2 — Governance.** Budget layers, approval audit trails, workflow-engine concurrency locks, typed output contracts, and an honest ledger of accepted security risk.
- **Part 3 — Agent Runtime Architecture.** Splitting identity from instance, machine identity for agents, on-behalf-of token exchange, memory as a first-class resource, and tool servers as their own resource type.
- **Part 4 — Operating It at Scale.** Edge threat modeling, component-prefixed versioning, and observability that doesn't couple itself to the request path.

Each of those posts made a case for a specific pattern. This one is where we admit that "made a case for" and "definitely got right" are not the same claim.

## Patterns that held up under real scale

A few decisions kept paying rent long after we made them, in ways we didn't fully anticipate at the time:

**Splitting agent identity from agent instance** turned out to matter more than we expected. The moment you can redeploy, resize, or even completely replace the runtime without touching the identity and configuration layer, a whole category of "why did this agent forget everything it knew" incidents just stops happening. We'd make this call again without hesitation.

**The workflow-engine-execution-ID-as-lock trick** has been quietly excellent — getting "only one mutating operation per resource" essentially for free from infrastructure you already run is the kind of thing that looks clever on a diagram and, more importantly, has just worked in production without drama. The caveat we'd add now that we didn't fully appreciate then: the discipline around *who* is allowed to mint the resource's version identifier (the orchestrator, never a retrying activity) matters more than the lock mechanism itself. Get that wrong and the elegant trick becomes a subtle, hard-to-reproduce bug.

**Treating accepted security risk as a maintained ledger rather than a one-time sign-off** has aged well. Security reviews get faster, not slower, when the reviewer can see "yes, we know about this, here's why we accepted it, here's what mitigates it" instead of re-litigating the same trade-off every quarter.

**Forking telemetry at a dedicated collector** rather than bolting it onto the request path — covered last post — is one we're glad we eventually did, even though we didn't do it from day one. More on that in a moment.

## Things we'd design differently, knowing what we know now

This is the section we mean the most sincerely in the whole series, so we're not going to soften it into false modesty or oversell it into false confidence either.

**We'd fork observability from day one, not after the pain.** We bolted analytics writes into the request path early, because it was faster to ship and traffic was low enough that nobody felt it. By the time it hurt, migrating away from the inline pattern was real work — untangling something load-bearing is always harder than building it decoupled from the start. If we were starting today, this would move from "post 20 in the series" to "week one."

**We're genuinely unsure we got the soft-budget-vs-hard-cap boundary exactly right.** The two-layer model — a platform-level soft allocation tracker plus a provider-enforced hard cap — has worked, but we've had more than one internal argument about whether the soft layer should have more teeth than it currently does, or whether that's exactly the kind of scope creep that turns a budget tracker into an approval bureaucracy nobody likes. We don't have a confident final answer here. If your org has landed somewhere different on this spectrum, we'd like to know where and why.

**The environment topology took longer to get right than any other single decision, and we're still not sure "four environment types" is the correct number for every org.** It was correct for the scale and risk profile we were operating at. A smaller, faster-moving org might reasonably run three; a heavily regulated one might need more granularity than four buckets can express. We'd encourage treating the *number* as a derived answer to your actual risk and release cadence, not a number to copy from a blog post — including, mildly amusingly, this one.

**We adopted component-prefixed versioning later than we should have.** Retrofitting a naming convention onto artifacts that already exist in various inconsistent shapes is more annoying than designing it in from the first release tag. Cheap insurance, purchased later than ideal.

**We're not fully settled on how much of the identity-ecosystem fork (Google Workspace vs. Microsoft/Azure) should be abstracted away versus deliberately leaned into.** There's a real tension between "stay cloud-agnostic for optionality" and "commit hard to one ecosystem's primitives and move faster." We landed closer to the second, and it's worked, but we wouldn't claim it's obviously the right call for every org — it's a bet on not needing to switch, and bets on not needing to switch are exactly the kind of bet that occasionally turns out to be wrong.

*Diagram: open `diagrams/21-full-platform-overview.html` in a browser — it assembles the whole series into one picture: environments containing the control plane, model registry, and budget layer; the identity/secrets layer; the agent runtime (identity vs. instance, memory, tool servers); the LLM gateway with its edge security layers; and the observability fork feeding a governed analytics store, end to end.*

## If you're starting today: a rough checklist, roughly in order

Not a prescription — more like the order we wish we'd made these decisions in, knowing what each one blocks:

1. **Pick your identity ecosystem deliberately, early, and in writing.** Google Workspace, Microsoft/Azure, or a deliberately cloud-agnostic stance — this forks nearly everything downstream, and revisiting it later is expensive.
2. **Decide your environment topology based on actual release cadence and risk tolerance**, not a number you read somewhere (including here).
3. **Design your budget model as two layers from the start** — a soft tracking layer and a hard provider-enforced cap — even if you're not sure yet exactly where the line between them belongs.
4. **Decouple agent identity from agent runtime instance before you've built more than one agent.** Retrofitting this later means migrating live state, which nobody enjoys.
5. **Build the observability fork before the request path has anything real riding on it.** This is the one item on this list we'd move earliest if we could redo the sequencing.
6. **Establish component-prefixed versioning (or your chosen equivalent) with your very first release tag**, not your fiftieth.
7. **Start the accepted-security-risk ledger with your very first accepted risk.** It's much harder to reconstruct "why did we accept this" retroactively than to write it down when the decision is fresh.
8. **Treat memory as a resource with an owner and a lifecycle from the first agent you build**, even if it's a small one — the alternative is retrofitting a data model under agents that are already in production and already have opinions about their own state.
9. **Layer edge security in two tiers (network + payload-aware) before your first internet-facing endpoint**, not after the first incident that makes the gap obvious.
10. **Write down the trade-offs you're not sure about, on purpose, the way we just did in this post.** Future-you will either thank present-you for the honesty or catch the mistake sooner. Both outcomes beat pretending certainty you didn't have.

## Where we'd like this to go from here

We wrote this series the way we'd want to read one — as a set of decisions made under real constraints, with the reasoning shown, not as a set of best practices to copy verbatim. Some of what's here will map cleanly onto your org. Some of it won't, because your identity ecosystem, risk tolerance, or scale is different, and that's not a flaw in the framework — it's the actual point of writing down the reasoning instead of just the conclusion.

If you've built something in this space and landed on different answers — a different budget boundary, a different environment count, a different take on the identity-ecosystem bet — we'd genuinely rather hear where this series got it wrong for your context than have it read as more settled than it is. Disagreement here is useful information, not a challenge to be defended against.

Thanks for reading the whole thing. Go build something, and tell us what you'd do differently.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #AIStrategy #TechLeadership #ArchitectureRetrospective #SystemDesign #AgentArchitecture #CTO #EngineeringCulture #LessonsLearned
