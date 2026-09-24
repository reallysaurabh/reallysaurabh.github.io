---
title: "Google Workspace vs. Microsoft 365/Azure: How Your Identity Ecosystem Forks Your AI Platform"
subtitle: "You don't pick your cloud identity provider. It picks you, sometime around when someone signed a contract you weren't in the room for."
series: "Building an Enterprise AI Platform That Scales"
part: "Part 0, post 2 of 21"
read_time: "10 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "PlatformEngineering", "IAM", "CloudArchitecture", "GoogleWorkspace", "Azure", "MultiCloud"]
---

If you take nothing else from this post, take this: the decision that will most shape your AI platform's architecture was probably made by whoever picked your company's productivity suite, years before anyone thought about agents at all.

That's not a complaint, it's just an observation worth sitting with. Your AI platform doesn't exist in a vacuum — it exists on top of whatever identity ecosystem your org already committed to. If you're a Google Workspace shop, the primitives you reach for by default are different than if you're on Microsoft 365 with Azure underneath. Neither is wrong. But pretending the choice doesn't ripple through everything downstream is how you end up fighting your own identity provider for a year, which is a genuinely miserable way to spend a year.

We ended up building on the Microsoft/Azure side, so that's where our detail is deepest — but the goal here is to give you an honest map of both paths, not a sales pitch for the one we happened to land on.

## Fork 1: How does an agent prove who it is?

Every agent that calls a downstream service — a database, a storage bucket, another internal API — needs to authenticate as *something*. The old answer was a long-lived API key or a service account key file sitting on disk somewhere, quietly becoming a liability the moment it's created. Both major ecosystems have moved past that, but via different primitives.

**On Azure**, the pattern is Workload Identity / Managed Identity plus federated credentials through Entra ID. A workload presents proof of its own identity (a Kubernetes service account token, for example) to Entra, which exchanges it for a short-lived Azure access token. No secret ever gets stored. The federation trust relationship is the thing you configure once; after that, tokens flow on demand.

**On Google Cloud / Workspace**, the equivalent is Workload Identity Federation, often paired with service account impersonation. A workload presents an external identity token, Google's STS-equivalent exchanges it for a short-lived token tied to a Google service account, and that service account's permissions — not the workload's own identity — govern what it can touch.

*Diagram: open `diagrams/02-identity-ecosystem-fork.html` in a browser.* It puts both paths side by side — Google Workspace/GCP on the left, Microsoft 365/Azure on the right — so you can see exactly where the federation flow diverges in the middle and reconverges on the same outcome: a short-lived credential, no stored secret.

Functionally these converge on the same outcome: no long-lived secret, short-lived tokens, an auditable trust boundary. The shape of *how you configure and reason about that boundary* differs enough that we wouldn't try to write one integration that abstracts both cleanly — we tried, briefly, and it wasn't worth the complexity it added. We cover this pattern in a lot more depth, including the failure modes of get it wrong, in [post 13](13-machine-identity-for-agents.md).

## Fork 2: Acting as the user, not as the platform

Say an agent needs to fetch a file from a user's own drive, or send an email as them, or query a system with the user's specific permissions rather than some blanket service identity. This is the on-behalf-of problem, and it's one of the places the two ecosystems diverge the most in how explicit the primitive is.

**Entra ID** has On-Behalf-Of (OBO) as a named, first-class OAuth 2.0 flow: a service holding a token for user A can exchange it for a new token, also scoped to user A, valid for calling a *different* downstream resource. It's documented, it's a standard grant type, and once you've implemented it once, every subsequent OBO integration looks the same.

**Google's ecosystem** gets you to the same place, but the road is different — domain-wide delegation (a service account granted the right to impersonate any user in the domain for specific scopes) or more granular impersonation via short-lived credentials. It's powerful, but domain-wide delegation in particular is a blunter instrument than OBO — it's delegation *for a whole domain*, which means your scoping discipline has to come from how carefully you configure the delegated scopes, not from the primitive itself narrowing things for you.

Neither path is inherently less secure than the other, but they fail differently when someone's in a hurry: Entra's OBO fails by "this specific downstream call didn't get authorized," Google's domain-wide delegation fails, if misconfigured, by "this service account can now act as anyone in the company for this scope." We've come to prefer flows with a narrower blast radius by default, but we'll be honest that this is partly a comfort-with-the-primitive thing, not a purely objective ranking — teams who live in Google Workspace every day may reasonably feel the opposite about Entra's model. [Post 14](14-on-behalf-of-agent-acting-as-user.md) goes deep on this pattern generically.

## Fork 3: Where do secrets actually live?

Every platform eventually has *some* secret that can't be federated away entirely — a third-party API credential, a webhook signing secret. Azure gives you Key Vault; Google gives you Secret Manager. Both are solid, both integrate natively with their respective workload identity story, and honestly, at this layer the two are more similar than different — access policies, versioning, audit logging, all present in both.

Where it gets more interesting is if you're multi-cloud, or expect to be. A cloud-agnostic secrets layer — something like Vault, run as its own service — buys you one mental model regardless of which cloud a given workload runs in, at the cost of an extra system you now operate yourselves instead of getting for free from the platform. We've used both approaches for different pieces of the stack, and we don't think there's a universally correct answer here — it depends heavily on whether "multi-cloud" for you means "genuinely running production in two clouds" or "we might, theoretically, someday," which are very different planning problems.

## Fork 4: The model plane itself

**Azure** routes you toward Azure OpenAI or Azure AI Foundry as the managed model layer, with model deployments as Azure resources, region and capacity managed like any other Azure service. **Google** routes you toward Vertex AI, with its own model garden, deployment, and quota model.

The specific vendor-facing names and versions you get from either — a model string, a deployment name, a version tag — are exactly the kind of thing you should *not* let leak directly into your own platform's API contract. We'll make the full case for that in [post 4](04-dont-leak-vendor-model-names.md), but the short version: whichever model plane you're on, decouple your resource identifier from theirs, because you will regret exposing a string you don't control as if it were an API contract you do.

## Fork 5: How your tenant model maps to environments

Google Workspace tends toward a flatter organizational-unit model; Azure AD's tenant/subscription hierarchy is more nested by default — management groups, subscriptions, resource groups, each a natural boundary. Neither is better for modeling *environments* (dev/staging/prod), but the Azure hierarchy nudges you toward mapping environments onto subscriptions fairly naturally, while on the Google side you're more likely to lean on projects and folders to get an equivalent separation. We'll get concrete about environment topology in [post 3](03-environments-not-just-endpoints.md) — worth reading with your own tenant structure in mind, since the "right" mapping really does depend on which hierarchy you're starting from.

## So which one do you pick?

If you're reading this pre-decision — genuinely lucky, most orgs aren't — the honest answer is: you probably don't pick based on this post. You pick based on where your company already lives, and you build the platform to fit that ecosystem's grain rather than fighting it.

Where it gets more interesting is the *cloud-agnostic* question: should the platform layer itself — the control plane, the budget ledger, the model registry — be written to run on either ecosystem, or should it commit hard to one and move fast? Our honest answer, and we hold this loosely, is: commit to one identity ecosystem for agent authentication and secrets (fighting two federation models at once is a tax with no payoff until you have a real multi-cloud requirement), but keep your core data model and API contracts ecosystem-agnostic from day one, because that decoupling is cheap now and expensive to retrofit later. We're not fully certain this is the right split for every org's risk tolerance, and if you've made the opposite bet — full multi-cloud from day one — I'd be curious what it cost you and whether it paid off.

Next up: [post 3](03-environments-not-just-endpoints.md), on why your platform needs actual environments — not just a `/prod` and a `/not-prod` — and the governance rule we found ourselves needing the hard way.

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #PlatformEngineering #IAM #CloudArchitecture #GoogleWorkspace #Azure #MultiCloud #IdentityManagement
