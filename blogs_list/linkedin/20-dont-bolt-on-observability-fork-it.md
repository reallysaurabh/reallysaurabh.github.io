---
title: "Don't Bolt Observability Onto the Request Path — Fork It"
subtitle: "Your analytics pipeline having a bad day should be its own problem, not everyone's"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 4, post 20 of 21"
read_time: "8 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "PlatformEngineering", "Observability", "DataEngineering", "LLMOps", "SystemDesign"]
---

Somewhere in most platforms' history, someone asks a perfectly reasonable question — "can we get usage and cost data into the analytics warehouse?" — and someone else, also being perfectly reasonable, adds a call to the warehouse right there in the request-handling code. Eighteen months later, the warehouse has a slow day, and suddenly every live LLM request is timing out because of a system that has nothing to do with serving the request. This is not a hypothetical anyone in platform engineering needs help imagining.

## The instinct, and why it's understandable

Piping usage and trace telemetry — prompts, completions, token counts, latencies, costs — into a governed analytics store is genuinely valuable. Compliance teams want it for audit. Finance wants it for cost attribution. ML teams want it for model-behavior review. The instinct to add "send this to the warehouse" as one more step in the request-handling path is completely understandable, because it's the path that already has all the data sitting right there in memory.

It's also, in our experience, the wrong place to put it — not because the goal is wrong, but because of what it couples together.

## The coupling problem

Once the analytics write is inline in the request path, your live LLM traffic inherits the availability and latency characteristics of your analytics store, whether anyone intended that or not. A few ways this goes wrong, none of them exotic:

- **The warehouse has a slow write day** (indexing, backfill, a downstream job hogging resources) and now every LLM request pays that latency tax, even though nobody using the actual product cares about analytics freshness in the moment.
- **The warehouse has an outage.** If the write is synchronous and unguarded, requests start failing not because the model is unavailable, but because a completely unrelated compliance pipeline is down. Explaining that incident to leadership is a special kind of unpleasant.
- **The schema changes**, or the write path picks up a new required field, and a deploy to the analytics side now has blast radius on live traffic that nobody modeling "what could this deploy break" would have guessed.

The pattern underneath all three: **a system that exists to relay requests to a model has acquired a second job — being reliable infrastructure for a downstream analytics pipeline — and nobody explicitly decided that trade-off.** It just accumulated.

## What we've done instead: fork the stream at a dedicated collector

The alternative we've settled into — and we'll say up front, it took us a couple of iterations to get here, this wasn't the first thing we tried — is to fork the trace stream at a dedicated collector sitting outside the request-response cycle, rather than writing to the analytics store from inside it. The gateway emits its trace data once, to the fork point; the fork point is responsible for getting it to the governed analytics store, buffering, retrying, and degrading independently of whether a live request is in flight.

*Diagram: open `diagrams/20-trace-collector-fork.html` in a browser — it shows the client-to-model request path running independently of a trace collector that forks off the traffic and feeds a governed analytics store, so slowness or an outage downstream never touches the live path.*

The property this buys you, stated plainly: **the analytics store can be on fire, and nobody serving a live request needs to know or care.** The collector can buffer, drop with a logged warning, retry on its own schedule, or fall over entirely — and the worst outcome is a gap in yesterday's usage dashboard, not a page at 2 a.m. for an outage that was never really about serving requests in the first place.

## A small, hypothetical example

Picture a platform that added inline analytics writes early on, when traffic was low and nobody had felt the pain yet. Eighteen months and ten times the traffic later, a routine index rebuild on the analytics warehouse slows every write by 400ms. Every LLM request — regardless of anything to do with the model itself — now takes 400ms longer, and the on-call engineer spends the first hour of the incident looking at the model provider's status page, because that's the obvious suspect. It takes a while to even *consider* that the slowdown has nothing to do with the model at all. That hour is the tax you pay for coupling two systems that never needed to be coupled.

## Why this isn't free, and where we're genuinely unsure

We don't want to oversell this — forking the stream introduces its own honest trade-offs:

- **You've added a component.** The collector is one more thing to run, monitor, and keep healthy, and "one more thing to run" is never actually free, even when the alternative is worse.
- **You've introduced eventual consistency for analytics data.** If the collector buffers or briefly falls behind, the warehouse is now slightly stale relative to what's happening live. For most of the use cases we listed — audit, cost attribution, behavior review — that's a completely acceptable trade. If someone needs real-time trace visibility for an active incident, this isn't the tool for that, and we'd reach for something else (live log tailing, request-scoped tracing) for that specific need.
- **The failure mode has moved, not disappeared.** If the collector itself gets overwhelmed, you need it to degrade gracefully — drop and log, rather than back-pressure onto the gateway — or you've just rebuilt the coupling problem one hop downstream. We think we've gotten this right, but we haven't yet had the traffic spike that would really prove it.

## Pitfalls

- **Building the fork, then accidentally making the gateway wait for the collector to acknowledge.** This defeats the entire point — if the gateway blocks on the collector's response, you've reintroduced the coupling with extra steps.
- **Assuming "async" automatically means "safe."** An unbounded in-memory queue in front of a slow collector is just a slower-motion version of the same failure — it needs backpressure or a bounded buffer with an explicit drop policy.
- **Forgetting that the collector itself needs monitoring.** It's now a real piece of infrastructure, not a fire-and-forget log statement, and it deserves the same operational attention as anything else load-bearing.
- **Skipping this because "we're too small to need it yet."** Maybe — but the fork is meaningfully cheaper to build before there's an established inline pattern to migrate away from. We added ours later than we'd have liked.

If you've solved the "observability without coupling" problem a different way — a service mesh sidecar, a message queue, something else — we'd be glad to hear how it's holding up under real load, because we suspect the fork-at-a-collector pattern isn't the only reasonable shape this can take.

Next up, the capstone: **"What We'd Do Differently: Patterns That Held Up and Ones That Didn't."**

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #PlatformEngineering #Observability #DataEngineering #LLMOps #SystemDesign
