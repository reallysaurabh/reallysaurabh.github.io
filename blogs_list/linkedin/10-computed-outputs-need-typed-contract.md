---
title: "Computed Outputs Deserve Their Own Typed Contract"
subtitle: "A small modeling decision that either keeps your data honest or quietly lets it drift"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 2, post 10 of 21"
read_time: "7 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "APIDesign", "DataModeling", "SoftwareArchitecture"]
---

We've come to believe one of the smallest, least glamorous decisions in a provisioning API's design is also one of the most consequential: what exactly goes in the "outputs" field, and what doesn't.

## Inputs, Outputs, and the Blob That Ate Both

A provisioning resource — a model registration, an environment, whatever your platform manages — typically has a spec (what the caller asked for) and some kind of status or outputs (what the system produced in response). This distinction sounds obvious until you actually look at a few real schemas, where it's astonishingly common to find the same fact represented twice: once in the spec, because the caller supplied it, and again in the outputs, because someone found it convenient to also store it there.

Here's a concrete, deliberately generic example: a resource that references a container image by tag — say, `my-model:v2` — and separately gets an image digest resolved by the registry at deploy time. The tag is input. The caller wrote it. The digest is output — nobody could have supplied it, because it doesn't exist until the registry computes it. That distinction is clean and worth protecting. What we've seen go wrong, more than once, is a schema where the *resolved tag* also gets copied into the outputs alongside the digest — "just to have it all in one place." Now you have two homes for the same fact, and the moment someone updates the spec's tag without updating the copy sitting in outputs, you have a system that can't tell you, truthfully, what a component is currently pointing at.

*Diagram: open `diagrams/10-input-vs-output-contract.html` in a browser.* It's a simple two-column split showing spec (input) fields against status/outputs (computed) fields on the same resource, with a dashed line marking the rule: nothing crosses from left to right unmodified.

## The Rule We've Settled On (So Far)

The rule that's worked for us: outputs are reserved for values the system genuinely computed and the caller could not have supplied — an assigned identifier, a resolved digest, a generated ARN or URI, a status the system determined through its own logic. If a value is already sitting in the spec, don't also persist a copy of it into outputs and then read it back from there later. Read the spec. That's where the truth already lives, and it's the only place it needs to live.

This matters more than it sounds like it should, for two reasons we've actually run into. First, two copies of one fact will drift, and — this is the annoying part — it's always the *persisted* copy that goes stale, because the persisted copy is the one nobody has a reason to touch again once it's written. The spec gets edited when someone changes their mind; the forgotten copy sitting in outputs just sits there, correct until the moment it silently isn't. Second, once you have a stale-copy problem, you've also created a migration-shaped headache with zero new information to show for it: existing rows don't have whatever new key you're about to add for a "previous value" or "last known" field, so now you need a backfill — for a fact you could have derived from data you already had.

There's a related trap worth flagging: if you're trying to detect *change* — "did the caller's image reference change since the last run?" — the temptation is to persist a `previous_image_ref` field somewhere in outputs so you can diff against it next time. We'd gently push back on that instinct too. The system already has the previous spec, sitting in the row from before this run overwrote it, or in whatever history/versioning your storage layer gives you. A "previous value" field written into the current row is wrong the instant the current run's changes land — it describes a moment that, structurally, no longer exists by the time anyone reads it. If you need the previous value, thread it through as an explicit parameter on the request that's doing the comparison (something like `PreviousImage` passed in fresh each time), rather than parking it in the persisted spec.

## A Small Worked Example

A scaling logistics company's platform team once had a resource type where the API's outputs included both `resolvedModelId` (genuinely computed — an internal ID the system assigned) and `providerModelName` (not computed at all — it was the exact string the caller had put in the spec, copied over "for convenience" so consumers wouldn't need to look at two places). Six months later, a caller updated the spec's model name to point at a newer version, and a downstream billing report kept citing the old one — because it had, quite reasonably, been reading from outputs the whole time, and nobody had told it that field was a stale echo rather than a live fact. The fix wasn't complicated: delete the redundant output field, point the one remaining consumer at the spec instead. The complication was entirely in finding every place that had quietly started trusting the wrong copy.

## Pitfalls

The instinct to duplicate input into output almost always comes from a good place — wanting a single, convenient read path so consumers don't have to know your schema's internal boundary between spec and status. That's a legitimate UX goal for an API response, and we don't think the fix is "make consumers read two places." The fix is to compose the response at the *serving* layer — merge spec and computed-status into a single view *for the response*, without ever persisting the merged copy as if it were itself a source of truth. Where we're least sure of ourselves: how far to take that composition before it starts hiding the very boundary we're trying to protect. We don't have a crisp rule for that line yet — if you've found one, we're listening.

Typed contracts protect you from your own data drifting. The next post is about protecting against something less abstract: engineers writing down, on purpose, the security compromises they've decided to live with — **The Security Trade-Off Ledger: Documenting Accepted Risk on Purpose.**

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #APIDesign #DataModeling #SoftwareArchitecture
