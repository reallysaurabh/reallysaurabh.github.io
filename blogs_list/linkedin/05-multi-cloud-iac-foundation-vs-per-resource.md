---
title: "Multi-Cloud Infrastructure as Code: Foundation vs. Per-Resource Provisioning"
subtitle: "Someone deletes a 'resource.' The shared networking everyone depends on goes with it. Nobody meant for this to happen. It happened anyway."
series: "Building an Enterprise AI Platform That Scales"
part: "Part 1, post 5 of 21"
read_time: "9 min read"
tags: ["EnterpriseAI", "AIPlatform", "InfrastructureAsCode", "MultiCloud", "CloudArchitecture", "PlatformEngineering", "DevOps"]
---

There are two very different kinds of infrastructure hiding under the single word "provisioning," and conflating them is one of the more expensive mistakes we've made building this platform — expensive enough that we're fairly confident in flagging it early, even while we're less confident we've got every detail of the split exactly right.

## Two kinds of infrastructure, one word

**Foundation infrastructure** is the stuff provisioned once per account or region and meant to sit there, quietly, for years: shared networking, base IAM roles and federation trust relationships, the account-level scaffolding that everything else assumes exists. Nobody creates a new one of these every time a customer signs up. It's provisioned deliberately, rarely, usually by a small number of people who think hard about it first.

**Per-resource infrastructure** is the opposite: created and destroyed constantly, one instance per logical resource in your platform — a model deployment, an agent's runtime environment, a pipeline execution's scratch storage. It's templated, it's routine, and it should be about as exciting to create or delete as adding a row to a database table.

The trouble starts when a platform's tooling doesn't clearly separate these two, and "delete this resource" ends up structurally capable of reaching into and tearing down something in the foundation layer.

## What it looks like when this goes wrong

Here's a version of the scenario that's easy to imagine happening to a scaling logistics company running AI infrastructure across two cloud regions: a per-resource deprovisioning routine is written to "clean up everything associated with this resource," and — because the resource's provisioning template happened to also touch a piece of shared networking config, maybe just to attach it — the cleanup routine tears that shared piece down too, on the theory that if it created it, it can also delete it.

Except it didn't create it. It reused something that was already there, that a dozen other resources also depend on. The deprovisioning succeeds without complaint, exactly as designed, and a few minutes later some completely unrelated team's traffic starts failing in a way nobody would think to connect to "someone deleted an AI agent that had nothing to do with them."

*Diagram: open `diagrams/05-foundation-vs-per-resource.html` in a browser.* It shows the foundation layer sitting underneath, long-lived and rarely touched, with per-resource stacks provisioned on top of it — plus the saga/compensation rollback path that fires when a per-resource provision fails partway through.

## The fix: a hard line, enforced by structure, not by good intentions

The rule we landed on is blunt on purpose: per-resource provisioning is only ever allowed to create and destroy things scoped to that one resource. It can *reference* foundation infrastructure — read a shared network ID, assume a role that already exists — but it structurally cannot create or delete anything at the foundation layer. That boundary lives in the tooling, not in a wiki page asking people to be careful, because "please be careful" is not infrastructure — it's a wish.

The corollary that matters just as much: foundation infrastructure changes go through a much heavier, much less frequent process — deliberately so. If provisioning a new region's networking feels like it should take a thoughtful afternoon and a review, and provisioning one more model deployment should take seconds and no review at all, that asymmetry is a feature, not an inconsistency. Different blast radii deserve different amounts of friction.

## Saga-style compensation for the routine layer

Because per-resource provisioning happens constantly, failures partway through are not an edge case — they're a Tuesday. A model deployment might succeed at step one (register the resource), fail at step two (provision the compute), and now you need to roll back step one cleanly, not leave a half-created resource sitting around confusing everyone who queries the registry.

We use a saga pattern here: each per-resource provisioning step has a defined compensating action, and a failure at any step triggers the compensations for everything that already succeeded, in reverse order. This is well-trodden ground in distributed systems generally — nothing AI-specific about it — but it's easy to skip when a platform is young and every provisioning path was written assuming the happy path, because the happy path is the one anyone tests first.

## What we're less sure about

Where we've gone back and forth: how much foundation infrastructure to provision *ahead* of demand (one region, ready before the first resource needs it) versus reactively, the first time something in a new region actually needs it. Ahead-of-demand is simpler to reason about but means paying for and maintaining capacity nobody's using yet; reactive is leaner but adds a "first resource in a new region" code path that's exercised rarely enough to be a little scary. We've mostly leaned ahead-of-demand for regions, reactive for smaller shared components — but this doesn't feel like a universal answer, more like a judgment call that depends on how predictable your growth actually is. Curious how others have drawn this line.

Next: [post 6](06-secretless-provisioning-federated-identity.md), on the identity side of provisioning — getting rid of long-lived cloud credentials in the pipelines that do all this creating and destroying in the first place.

**Suggested hashtags:** #EnterpriseAI #AIPlatform #InfrastructureAsCode #MultiCloud #CloudArchitecture #PlatformEngineering #DevOps #AIInfrastructure #Pulumi
