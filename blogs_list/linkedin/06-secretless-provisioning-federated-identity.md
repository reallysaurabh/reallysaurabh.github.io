---
title: "Secretless Provisioning: Federated Identity for Infrastructure-as-Code"
subtitle: "The most secure cloud credential is the one that expires before anyone thinks to steal it."
series: "Building an Enterprise AI Platform That Scales"
part: "Part 1, post 6 of 21"
read_time: "8 min read"
tags: ["EnterpriseAI", "AIPlatform", "InfrastructureAsCode", "IAM", "CloudSecurity", "MultiCloud", "PlatformEngineering"]
---

Long-lived cloud provider keys are the credentials equivalent of leaving a spare house key under the doormat: convenient right up until literally anyone figures out where you keep it, and by the time you find out, they've already been inside.

Provisioning pipelines are one of the more dangerous places for this pattern to live, precisely because they usually need *broad* permissions — creating and destroying real infrastructure across a cloud account — which makes a leaked static credential here a genuinely bad day, not a minor incident.

## The pattern: exchange, don't store

The approach we've settled on, and one we'd recommend at least trying before reaching for a stored key: the provisioning pipeline never holds a long-lived cloud credential at all. Instead, it holds a *workload identity* — proof of who it is, issued by something the pipeline already trusts, like the CI system or the orchestration platform it runs on. When it needs to actually touch a cloud API, it presents that workload identity token to the cloud provider's identity service, which — having been configured, once, to trust that specific token issuer for a specific scope — exchanges it for a short-lived, narrowly scoped cloud credential. That credential does the actual work and then expires, typically within the hour.

*Diagram: open `diagrams/06-secretless-provisioning-sequence.html` in a browser.* It walks through the sequence: pipeline presents its internal token, the identity provider exchanges it for a short-lived cloud credential, the cloud API call happens — and at no point does a long-lived secret sit anywhere in the flow, including in whatever secret store you'd otherwise be tempted to put it in.

The genuinely nice property here is that there's no secret to rotate, because there's no secret. The trust relationship — "tokens from this issuer, with this specific claim, get exchanged for this cloud role" — is the thing you configure, once, carefully, and after that the tokens just flow.

## Both ecosystems get you here, differently

We touched on this in [post 2](02-identity-ecosystem-fork-google-vs-azure.md), and it's worth restating in the provisioning context specifically, because the two paths really do feel different day to day even though they land in the same place:

**On the Google side**, Workload Identity Federation lets an external identity (say, a CI runner's own OIDC token) be exchanged for a Google-issued short-lived credential tied to a service account, with the service account's own permissions governing the blast radius.

**On the Azure side**, Workload Identity via Entra ID federated credentials does the equivalent: a federated credential trust configured against a specific external issuer and subject, exchanged for a short-lived Azure AD token, which then authorizes the actual resource calls through RBAC.

We ended up deepest on the Azure side for our own provisioning pipelines, so that's where we'd defer to others' experience more — if you've run this pattern hard on the Google side and hit rough edges we haven't, that's genuinely useful for us to hear too.

## The failure mode this doesn't fully solve: orphaned locks

Secretless provisioning solves the "who is this pipeline, and what can it touch" problem. It does not, by itself, solve a different problem that shows up in the same neighborhood: what happens when a provisioning process gets killed — a deploy timeout, a crashed worker, someone hitting cancel at exactly the wrong moment — while it's holding a lock on the resource it was provisioning.

If a resource's concurrency model is "only one provisioning operation at a time, enforced by a lock," and the process holding that lock dies without releasing it, the resource is now stuck. Forever, unless something notices. Nobody can provision, update, or deprovision it, because the system correctly believes an operation is still in progress — it just doesn't know that operation is never coming back.

We handle this with a heartbeat/timeout mechanism: a lock has to be periodically renewed by the process holding it, and if it goes stale past a threshold, the platform treats it as abandoned and clears it, logging that this happened so someone can go check what actually occurred. This is a fairly standard distributed-locking pattern, and we don't think we've invented anything new here — but it's easy to forget to build until the first time a resource gets stuck and someone has to manually intervene at an inconvenient hour.

## Where we're still not fully settled

The part we go back and forth on: how aggressive the timeout should be. Too short, and a legitimately slow (but healthy) provisioning operation gets its lock yanked out from under it, which can be its own kind of mess if a second operation starts before the first one's cleanup has actually finished. Too long, and a genuinely stuck resource sits unusable for longer than it needs to. We've tuned ours empirically, based on how long our slowest real operations actually take, rather than picking a number that felt principled — which is a slightly unsatisfying answer, but it's the honest one.

Next: [post 7](07-two-layer-budget-problem.md), where the series shifts from provisioning into governance — starting with the surprisingly tricky problem of tracking AI spend at two layers that must not be allowed to disagree with each other.

**Suggested hashtags:** #EnterpriseAI #AIPlatform #InfrastructureAsCode #IAM #CloudSecurity #MultiCloud #PlatformEngineering #ZeroTrust #DevOps
