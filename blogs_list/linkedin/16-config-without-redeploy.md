---
title: "Config That Changes Without a Redeploy: Env Vars and Protocol as Runtime Concerns"
subtitle: "If changing a timeout requires a release train, you didn't build infrastructure, you built a very slow form"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 3, post 16 of 21"
read_time: "7 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "DevOps", "ConfigManagement", "CloudNative"]
---

Immutable infrastructure is one of those ideas that's correct often enough to become dogma, and dogma is where good engineering practices go to stop being examined. "Never change a running deployment, always redeploy" is right for the things that determine correctness — code, dependencies, the artifact itself. It is *not* automatically right for every value that happens to live in a config file next to that artifact.

## The Tell: When "Just a Config Change" Becomes a Release

You know you've over-applied immutability when a one-line, low-risk config tweak — bump a timeout, add an allowed origin, switch which protocol an agent speaks to a particular tool server — requires the exact same ceremony as shipping new code: a build, a review, a staged rollout, a rollback plan for something that was never actually a code change in the first place.

Two things go wrong when this happens. First, it's slow — genuinely operationally slow, in a way that compounds when you're running dozens or hundreds of agents each with their own small config differences. Second, and worse, it creates the exact incentive you built immutability to prevent: when the "proper" path to change a value is annoyingly heavyweight, people start finding the improper path. Someone SSHes in, or exec's into a container, or hand-edits a value directly against production "just this once, I'll fix it properly tomorrow." Immutability's whole promise — that what's running matches what's declared — quietly stops being true, and nobody notices until it matters.

## Not All Config Is Created Equal

The fix isn't "abandon immutability." It's recognizing that config splits into two categories with genuinely different risk profiles:

**Build-time config** affects correctness. Which dependencies are compiled in, which model version an agent is pinned to, which code path executes. Changing this *should* require a full redeploy, because the whole point of a deploy pipeline — review, testing, staged rollout — exists to catch the ways this kind of change can break things.

**Runtime config** doesn't touch the deployed artifact's correctness at all. Environment variables that tune behavior (a timeout, a feature flag, an allowed-origins list), or which wire protocol an agent uses to talk to a given tool server. These are things that are *expected* to change often, don't require re-validating the artifact itself, and gain nothing from being bundled into a release.

The design move is to make the second category genuinely mutable in place — a config store an agent reads from at startup and can be told to re-read, or a control-plane API that pushes updated values to a running instance — while keeping the first category exactly as immutable as it already is.

*Diagram: open `diagrams/16-config-baked-vs-runtime.html` in a browser — a side-by-side comparison of "baked into image" (requires full redeploy) versus "injected at runtime" (mutable in place, no redeploy).*

## A Small, Concrete Example

Say an agent talks to a tool server over one transport protocol, and the platform team wants to migrate it to a newer one — a change that affects zero business logic, just how bytes move between two components that already trust each other. If protocol selection is baked into the deployment image, this "just a plumbing change" requires a full build-review-rollout cycle for every single agent using that tool server, on every team's schedule, coordinated across however many teams that turns out to be.

If protocol selection is a runtime config value instead, the migration becomes: update the value, the agent picks it up on its next config refresh (or immediately, if your control plane pushes it), done. No new image. No release coordination. No teams need to even notice unless something breaks — and if it does, rolling back is changing the value back, not re-deploying the previous artifact.

## Honestly, the Line Isn't Always Obvious

We'll admit the build-time/runtime distinction sounds cleaner than it always is to draw. We've had genuine disagreements internally about whether a given value — a retry count, say — is "just tuning" or "close enough to correctness-affecting" to warrant a real release. We don't have a crisp test for it beyond "when in doubt, treat it as build-time and revisit if the friction becomes a real problem." That's more of a heuristic than a principle, and we're open to a better one.

## A Few Things We'd Watch For

We'd be cautious about letting "runtime config" become an escape hatch for changes that actually affect correctness. If a wrong value could cause a subtly incorrect result rather than just a different-but-valid behavior, we've found it's usually worth the extra friction of treating it as build-time.

We'd also want a runtime config path to carry a real audit trail. Part of why people reach for hand-editing prod is that it's fast — if the legitimate mechanism is just as fast but logged, versioned, and attributable, that removes most of the incentive for the workaround. Fast but unaudited just legitimizes the same risk under a nicer name.

And it's worth not skipping validation just because a change is "only" runtime config — a malformed protocol value or a nonsensical timeout pushed at runtime can break an agent as thoroughly as bad code, often faster, since it skips whatever gates a real deploy would have gone through.

Getting the build-time/runtime split roughly right has kept our platform faster without feeling reckless, though we're still refining where exactly the line sits. The next post asks a related question — not about *what* config an agent needs, but about *tool servers* it depends on, and why those seemed to want a resource type of their own.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #DevOps #ConfigManagement #CloudNative
