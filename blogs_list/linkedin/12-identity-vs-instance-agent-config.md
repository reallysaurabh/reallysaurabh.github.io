---
title: "Identity vs. Instance: Why Your Agent's Config Shouldn't Live Inside Its Deployment"
subtitle: "Redeploying an agent shouldn't mean reintroducing yourself to everyone it knows"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 3, post 12 of 21"
read_time: "8 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "AIAgents", "SoftwareArchitecture", "CloudArchitecture", "AgentArchitecture"]
---

Here's a question that sounds trivial until you've been burned by it: when you redeploy an agent, does it wake up as the same agent, or as a stranger wearing its clothes?

If your platform models "an agent" as a single resource — one row, one deployment, one everything — the honest answer is: a stranger. You just torn down the only place its identity lived and stood up a new one that happens to share a name. Every permission grant, every accrued piece of context, every downstream system that was told "this is Agent X, trust it" — gone, and quietly re-created from a template, if you're lucky enough to have a template.

## The Coupling Nobody Notices Until It Hurts

Most platforms don't set out to make this mistake. It happens by accretion. You start with an agent as a deployable thing — a container, a runtime, a process — because that's the part you can see running. Identity gets bolted on: an API key here, an IAM role there, maybe a database row that also happens to hold the deployment config. It all lives in one resource because, early on, one resource is all you have.

Then the platform matures. You need to redeploy an agent to bump its model version, or roll out a config change, or recover from a crashed instance. And now you discover that "redeploy" and "reissue the agent's entire identity" are the same operation, because you never separated them.

This is the practical cost:

- **Permissions evaporate.** If an agent's access grants were tied to the deployment rather than to a durable identity, every redeploy is a permissions outage until someone re-grants everything.
- **Audit trails snap in half.** "Agent X did this three weeks ago" and "Agent X did this five minutes ago" turn out to refer to two unrelated deployments that never shared so much as a UUID.
- **Downstream trust breaks.** Any system that authenticated the agent by its deployment-specific credential now has to be told, again, that the "new" agent is actually the same one it already trusted.
- **State and memory vanish**, which — if you've been following this series — is its own architectural sin (more on that two posts from now).

## Split the Resource on Purpose

The fix is not exotic. It's the same lesson every mature system eventually relearns: separate the thing that *is* from the thing that *runs*.

**Agent identity** is the stable layer. It's created once, holds a durable set of attributes — a name, an owner, accrued permissions, a place for durable memory to attach, an audit history — and critically, it holds no live infrastructure of its own. It cannot crash. It cannot need a restart. It is a record, not a process.

**Runtime instance** is the disposable layer. It's the actual deployed thing — the container, the process, the compute — created against a specific version of config, torn down and recreated freely. Redeploy, scale, recover from a crash, roll back a bad release: all of that happens entirely at the instance layer and never touches identity.

*Diagram: open `diagrams/12-identity-vs-instance.html` in a browser — it shows a single stable "Agent Identity" box with a sequence of "Runtime Instance" boxes underneath it over time (v1 torn down, v2 created, v3 current), each one pointing back to the same identity.*

Once you draw this line, a redeploy stops being an identity crisis. You tear down instance v2, stand up instance v3, and instance v3 points at the exact same identity record v1 and v2 did. Permissions didn't move because they were never attached to the instance. The audit trail is continuous because the identity that's being audited never changed. Nothing downstream needs to be told anything new, because as far as they're concerned, nothing happened — the agent they trust is still the agent they trust.

## A Small, Concrete Example

Picture a 200-engineer logistics company running an internal agent that reconciles shipment exceptions against a claims system. It's been running for four months, has an accrued set of read/write grants to three internal systems, and — because someone finally listened to post 15 in this series — a durable memory store of past exception patterns it's learned to recognize.

Now the team wants to bump it to a newer model version. If identity and instance are one resource, this "routine model bump" requires re-provisioning every downstream grant, reconnecting the memory store, and hoping the audit system's foreign keys don't mind that the agent effectively just died and was reborn. If they're split, the team deploys a new instance against the existing identity, the grants and memory were never touched, and the "big scary model upgrade" is, from every other system's point of view, a non-event.

That gap — between "routine deploy" and "identity crisis" — is the entire value of the split.

## Where We're Still Not Sure

One thing we've gone back and forth on: how much *should* survive a redeploy versus reset cleanly. Permissions and audit history, clearly, should survive. But should an in-flight task survive a redeploy, or is "finish or cleanly fail, then redeploy" the safer default? We've landed on the latter for now, mostly because resuming mid-task across a version boundary opens questions about state compatibility we didn't want to solve on day one. It's not obviously the right call, and if you've drawn that line differently, we'd genuinely like to compare notes.

## A Few Things That Tripped Us Up

**Watch for the instance leaking into the identity.** The temptation, once you've made the split, is to let convenience win — "let's just cache the current runtime's endpoint on the identity record for quick lookups." Resist it. The moment identity holds a live pointer to a specific instance, you've reintroduced the coupling through the back door, and your next redeploy will go looking for a phantom.

**We'd also flag: keep identity cheap to create.** The identity layer works best when it's boring to provision — a name, an owner, an empty slate for permissions and memory to attach to later. If provisioning an identity requires the same approval workflow as a production database, people tend to start reusing identities across unrelated agents just to skip the paperwork, which quietly undoes the whole benefit.

**And "stable" doesn't have to mean "immutable."** Identity attributes like ownership or permission grants absolutely change over time in our experience — what's stable is that they change independently of, and survive, any given deployment.

This split underpinned a lot of what came after for us: durable permissions, continuous audit trails, and — as the next post gets into — an identity an agent can actually prove it holds, without a human standing behind it holding a shared secret. We're curious whether other teams have found a lighter-weight way to get the same guarantees — if so, tell us how.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #AIAgents #SoftwareArchitecture #CloudArchitecture #AgentArchitecture
