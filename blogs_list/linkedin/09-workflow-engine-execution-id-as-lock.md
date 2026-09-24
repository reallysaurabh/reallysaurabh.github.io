---
title: "Using Your Workflow Engine's Execution ID as a Concurrency Lock"
subtitle: "A trick that feels like it's cheating physics, and a couple of ways it will happily cheat you back"
series: "Building an Enterprise AI Platform That Scales"
part: "Part 2, post 9 of 21"
read_time: "9 min read"
tags: ["EnterpriseAI", "AIInfrastructure", "AIPlatform", "AIGovernance", "PlatformEngineering", "DurableExecution", "DistributedSystems", "Concurrency", "WorkflowOrchestration"]
---

Somewhere in the middle of building a provisioning system, someone on your team will have a small, satisfying realization: "wait, our workflow engine already gives every run a unique ID — can't we just use *that* as the lock?" The answer is yes, and it's one of our favorite tricks in this whole series. It's also one we'd caution you not to trust blindly, because the two ways it goes wrong are subtle enough to survive code review.

## The Trick, Stated Plainly

If you're running mutating operations on a resource through a durable-execution or workflow engine (Temporal, Step Functions, whatever your stack uses), that engine is already generating a unique execution ID every time it starts a run. The insight is: you don't need a separate locking table, a separate `SELECT ... FOR UPDATE`, or a distributed lock service to guarantee "only one mutating operation on this resource at a time." You just need to record, on the resource itself, which execution ID currently "owns" it. A new mutation request checks that field first. If it's set to a live execution, the new request gets rejected or queued. If it's empty, the new request starts a workflow and claims the field with its own execution ID.

It's elegant because it's free — the uniqueness guarantee already exists inside the engine you're paying for anyway. You're not building a lock; you're borrowing one.

*Diagram: open `diagrams/09-execution-id-lock-sequence.html` in a browser.* It shows two concurrent requests hitting the same resource — one acquires the lock by starting a workflow execution, the second is rejected because the resource is already mapped to a live execution, and the lock releasing when that execution finishes.

## Where It's Bitten Us

We like this pattern a lot, and we'd still recommend it — but we've been burned by both of its sharp edges, and it's worth naming them plainly rather than presenting this as a solved problem.

**The mapping has to be complete and consistent in both directions.** It's not enough to know "this execution is currently working on resource X." You also need to be able to go the other way — "resource X is currently locked by execution Y" — reliably, at any point, including after a crash, a redeploy, or a stuck workflow that never got a graceful chance to release the lock. If either direction of that mapping can drift (say, the resource's lock field gets updated but the workflow's own record of what it's touching doesn't, or vice versa), you end up with a resource that's *functionally* locked forever because nothing agrees on who's allowed to unlock it. We've hit exactly this: a workflow that failed in a way that left the resource pointing at an execution ID the engine considered terminated, and nothing in our code was watching for that mismatch. The fix was a reconciliation job that checks resource-lock-state against actual live-execution-state, which — we'll be honest — feels a little bit like admitting the free lock wasn't entirely free.

**Only the owning orchestration process may mint the resource's version identifier.** This one is easy to get wrong if you're not thinking about it directly. A workflow typically has two kinds of code running inside it: the orchestration logic itself (which is expected to be deterministic and replay-safe) and the individual activities/steps it calls out to (which are expected to be retried, sometimes many times, sometimes concurrently with themselves during at-least-once delivery). If you let an *activity* mint or bump the resource's version/lock ID — rather than the orchestrator that's guaranteed to run that logic exactly once per logical attempt — a retry can mint a second, conflicting version stamp for what should be a single logical update. The rule that's worked for us: version-stamping is orchestration-layer responsibility, full stop, never delegated down into a retriable step.

## A Small Worked Example

Picture a scaling logistics company managing provisioned AI resources through a workflow engine. A "resize this resource" operation starts a workflow, which immediately writes its own execution ID onto the resource's `locked_by` field before doing anything else. A second resize request for the same resource arrives ninety seconds later; it reads `locked_by`, sees a non-empty value, checks with the engine whether that execution is still live, finds that it is, and returns a clean "resource is currently being modified, try again shortly" instead of racing the first request. When the first workflow finishes — success or failure — it clears `locked_by` as its last step, and the field's absence is now the only fact anyone needs to check to know the resource is free.

The part that took a second pass to get right was the "clear `locked_by` as its last step" part. Our first version cleared it in a `finally`-style cleanup activity — which, per the rule above, is exactly the kind of retriable step that shouldn't be trusted with a state transition this load-bearing. We moved the clear into the orchestrator's own guaranteed-once cleanup path instead.

## Pitfalls

Beyond the two big ones above, there's a smaller trap worth naming: don't let the lock outlive its usefulness by tying it to an execution's *start* rather than its actual completion signal. A workflow that legitimately takes twenty minutes will hold the lock for twenty minutes — which is correct, but only if everyone downstream (support engineers looking at a "stuck" resource, other services with their own timeouts) knows that's expected and isn't going to helpfully "fix" it by force-clearing the lock field by hand. We've had exactly one 2am incident caused by a well-meaning manual `UPDATE` clearing a lock that was, in fact, doing its job correctly.

If you've solved either of these two traps differently — especially the reconciliation-job problem — we'd genuinely like to compare notes; it's the part of this pattern we feel least settled on.

Once concurrency is handled, the next sharp edge tends to show up in what your provisioning API actually *returns* — which brings us to a deceptively simple rule: **Computed Outputs Deserve Their Own Typed Contract.**

**Suggested hashtags:** #EnterpriseAI #AIInfrastructure #AIPlatform #AIGovernance #PlatformEngineering #DurableExecution #DistributedSystems #Concurrency #WorkflowOrchestration
