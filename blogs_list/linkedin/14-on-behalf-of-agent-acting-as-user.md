---
title: "On-Behalf-Of: Letting an Agent Act as the User, Not as the Platform"
subtitle: "One almighty service account is not an identity model, it's a liability with an API"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 3, post 14 of 21"
read_time: "8 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "OAuth", "LeastPrivilege", "IdentityManagement", "AIAgents"]
---

Here's a question worth asking about any agent on your platform right now: when it reads a customer record, updates a ticket, or approves a request, whose permission is it actually using — the person who asked it to, or its own?

If the honest answer is "its own," you've built something that's convenient right up until the moment it isn't: a single, powerful identity that every user's request funnels through, meaning the agent can now do anything any of its users could ever plausibly need — added together, forever, with no way to tell afterward which user's intent justified which action.

## The Blanket-Identity Anti-Pattern

It's an easy trap to fall into because it's the *simplest possible thing that works*. You provision one service account for the agent, grant it enough permissions to do everything it might conceivably need to do on behalf of any user, and let every request flow through that one identity. The agent works. Demos go great. And you've just built a system where:

- **Every user effectively has the agent's permissions**, not their own. If the agent can read every customer's data because *some* user legitimately needs that for *some* customers, every user's request now has access to *every* customer, because the system has no concept of "this specific request should only see what this specific person is allowed to see."
- **The audit log lies by omission.** It can tell you "the agent did X," but not "user A asked for X, which they were allowed to do" versus "user B asked for the same X, which they weren't." From the log's perspective, those are identical events.
- **A compromised agent is a compromised everything.** One overly-broad credential, one prompt injection that convinces the agent to take an action it shouldn't, and the blast radius is the full permission set of every user combined — not the permission set of whoever actually triggered the request.

## Token Exchange Fixes the Whose-Permission-Is-This Problem

The fix is a pattern usually called **on-behalf-of (OBO)** token exchange, and the idea is almost embarrassingly simple once you see it: instead of the agent using its own identity to act, it exchanges the calling user's token for a new, narrowly-scoped token that represents *that specific user*, and uses *that* to make the downstream call.

*Diagram: open `diagrams/14-on-behalf-of-flow.html` in a browser — it shows User → Agent (holding the user's token) → Token Exchange service → a downstream call made as the user, contrasted with a crossed-out anti-pattern box where the agent just uses its own admin credential for everything.*

The mechanics: the user's original token (or an assertion of their identity) gets passed to a token exchange service, which validates that the agent is allowed to request this exchange, and — critically — issues a new token scoped to what *that user* can do, not what the agent can do. Every downstream system now sees a request that says "this specific user did this," which means:

- **Least privilege actually works**, because the token the downstream system honors reflects the user's real permissions, not the agent's ceiling.
- **Audit trails are actually true.** "User A did X" and "user B did X" are now genuinely different events with different provenance, because they are backed by different tokens.
- **A prompt injection or agent bug is contained** to whatever the *calling user* could have done anyway — which, for most users on most systems, is a lot less catastrophic than what a blanket service account could have done.

## A Small, Concrete Example

Picture an internal support agent at a healthcare SaaS company, built to help support reps look up patient billing questions. Junior reps can see billing status; senior reps can also issue refunds. If the agent runs under one shared service identity provisioned to "do whatever any rep might need," a junior rep asking an innocuous question is, technically, one clever prompt away from getting the agent to issue a refund — because the *agent* has that permission, even though *that specific rep* never should.

With OBO token exchange, the agent exchanges the junior rep's own token for a scoped one before making the refund-adjacent call. The downstream billing system checks that scoped token, sees "junior rep, no refund permission," and declines — exactly as it would if the rep had tried to do it by hand. The agent didn't need to be smart enough to enforce that boundary. The identity system enforced it for free.

## An Open Question We Haven't Fully Settled

Where we're less confident: how far down the call chain OBO should propagate when an agent calls another agent, which calls a tool server, which calls yet another service. In principle the user's identity should thread all the way through. In practice, each hop adds latency and complexity, and we've occasionally collapsed a hop back to a service identity for a narrow, well-audited case rather than build the full chain. We're not entirely comfortable with that compromise, and we'd be interested to know if others have found a cleaner way to keep the chain unbroken without the overhead.

## A Few Things We'd Watch For

Worth checking that "OBO" isn't quietly just a rename for the blanket identity — if the exchange service issues a token scoped to "whatever the agent is generally allowed to do" rather than the intersection of that and what the specific user can do, you've added a hop without adding much actual safety.

We'd also resist skipping OBO for flows that feel "trusted" because they're internal-only. That instinct is understandable, but it's often how blanket identities get grandfathered in and never revisited — internal agents touching real user data seem to accumulate access over time precisely because fewer people are watching.

And token lifetime matters more than it looks like it should: an OBO-exchanged token that lives for hours starts to function like a second static credential with extra steps. We've had better luck keeping it short-lived and re-exchanging per request, or per session at most, in keeping with the rotation discipline from the previous post.

Getting the "whose permission is this" question right made a real difference for us. The next post tackles a related but distinct question — what an agent is allowed to *remember* about someone afterward — and it's one where we changed our minds partway through building it.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #OAuth #LeastPrivilege #IdentityManagement #AIAgents
