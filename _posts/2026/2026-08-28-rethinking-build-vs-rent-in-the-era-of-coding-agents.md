---
layout: post
title: Rethinking Build vs. Rent in the Era of Coding Agents
description: Coding agents make it practical to replace recurring managed-service costs with reusable internal software built on proven components and cheaper infrastructure.
categories: [Software, AI, Infrastructure, Libraries, Testing]
image: content/images/rethinking-build-vs-rent-in-the-era-of-coding-agents.jpg
image_alt: Two industrial robots work on a partially assembled silver car body inside an automotive factory.
---

Back in 2014, I wrote a little thought experiment called [Not Invented Here Mechanic](/2014/12/05/not-invented-here-mechanic/).

In it, a mechanic talks a customer into replacing a blown tire with one he made on his first try out of mud, twine, and old shoe soles. He has never made a tire before, has not researched how specialists make them, and does not bother testing his creation before sending the customer onto the interstate at 75 miles per hour.

The mechanic stood in for a particular kind of software developer: somebody who assumes that a library they invented this afternoon must be better than one refined by specialists over several years, mainly because they invented it.

I still agree with that argument. Coding agents have not made it sensible to recreate a database driver, logging framework, or serialization library every time you open a repository. I am certainly not recommending that anybody roll their own encryption, authentication protocol, or other security-critical primitive. Those are exactly the places where the original warning applies most strongly. Proven parts are still proven parts.

What has changed is a related but different decision: whether to own a system assembled from those parts or rent the whole capability from a managed provider.

The original mechanic was deciding whether to fabricate his own tire instead of buying a good one. The agentic mechanic can buy good tires, brakes, and engines, then direct a whole staff to assemble and maintain the vehicle the customer actually needs. They have read the service manual for practically every vehicle ever produced, they have every machine tool in the catalog, and they are perfectly happy to drive the result around a test track a thousand times to find out where it fails.

That distinction matters. Agentic coding should not produce a different ORM, scheduler, and Kafka client in every repository. It should make it practical to combine mature libraries and commodity infrastructure into a narrow internal capability, build it once, and reuse it instead of paying the ongoing cost of a managed product everywhere it is needed.

## Building Is Cheaper Now

I recently wrote about the prospect of putting [a coding agent on every desk](/2026/08/26/running-qwen3-coder-next-on-bazzite/). A capable agent can inspect an unfamiliar repository, research its libraries, write an implementation, run the tests, observe the failure, and try again. More capable models can review the design, look for race conditions, generate adversarial cases, and explain assumptions buried in the code.

This feels less like giving every developer a better wrench and more like giving them a team of personal mechanics. The team has broad experience synthesized from an enormous number of other codebases and does not get tired of writing variations of the same integration test.

That changes the build-versus-rent calculation. The fixed cost of creating bespoke software used to overwhelm much of the money it could save. A tailored Kafka bridge, job host, or PostgreSQL-backed storage abstraction might have been cheaper to run than the managed alternative, but reaching an acceptable level of reliability took months of engineering work. Renting was often the rational default.

That fixed cost has fallen. A developer can now direct an agent through the repetitive implementation work, use a stronger model to review the hard decisions, and have the agent run the resulting component through hundreds of failure scenarios. The token and review cost is concentrated at the beginning; the lower runtime cost continues for the life of every system that reuses the result.

Consider a collection of applications that need a modest subset of Elasticsearch's capabilities. Instead of adding a managed Elasticsearch deployment to the stack, an organization can build one well-tested shared search library on top of PostgreSQL's indexing and search features. The library expresses the common query patterns, manages the schema and indexes, emits standard telemetry, and gives every application the same supported API. The organization pays the concentrated implementation cost once and runs the result on infrastructure it already knows how to operate cheaply.

The same logic applies to a focused Kafka bridge instead of a managed connector, or an owned job host instead of an [Azure Function](https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview/). The point is not to recreate the underlying platform. It is to own the narrow capability that the application actually needs.

Agents will still confidently misunderstand requirements and reproduce bad patterns from their training data. The response is to give them a precise work order and make them prove the result. [Generated code is a draft](/2025/07/31/build-software-like-a-sitcom-writers-room/). The system contract and acceptance tests decide whether that draft is allowed into production.

## Test Against the Real System

Imagine that you need to move messages from a Kafka topic into a database. [Confluent Cloud offers fully managed Kafka Connect connectors](https://docs.confluent.io/cloud/current/connectors/overview.html) for this sort of work. The underlying [Kafka Connect framework](https://kafka.apache.org/42/kafka-connect/overview/) handles details such as offset management that connector authors would otherwise need to get right themselves.

Owning that capability means more than calling `Consume` in a loop and inserting each result into a table. You have to decide when to commit an offset, what happens when a database write succeeds but the offset commit fails, whether two deliveries of the same message produce the same result, how to handle malformed records, and how the process shuts down during a rebalance or deployment. Then you need health checks, metrics, configuration, deployment manifests, documentation, and tests for all of it.

Do not ask an agent to implement that list and accept a [passing unit-test suite](/2026/04/02/testing-software-at-the-right-focal-length/) as proof. Give it an executable definition of reliability. Have it start real Kafka and database instances with [Testcontainers](https://dotnet.testcontainers.org/), then prove what happens during duplicate delivery, malformed input, transient database failures, restarts, consumer rebalances, and interrupted shutdowns. When a test exposes a race, let the agent revise the implementation and rerun the entire suite.

The pattern is straightforward: build the narrow behavior you need on top of mature parts, then test the seams where their guarantees meet yours. Use established Kafka clients, PostgreSQL drivers, cryptography libraries, dependency injection frameworks, and telemetry libraries. Do not reinvent Kafka, PostgreSQL, encryption, authentication protocols, or distributed consensus. Own the small layer that translates those systems into the exact semantics your applications need.

That is a much more useful application of agentic coding than asking a model to produce a large pile of plausible infrastructure code and hoping a code review finds the dangerous parts. The model can generate the implementation, but its most valuable work may be generating and repeatedly running the test track.

## Design Before You Generate

A hundred productive agents can build the wrong thing much faster than one person can.

Implementation used to contain natural speed bumps. A new piece of infrastructure had to be prioritized, staffed, and justified. The process could be bureaucratic, but it created opportunities to ask whether the proposed system was actually the right one.

Agents erase those speed bumps. A developer can have the first idea that comes to mind in the morning and a plausible implementation with a green test suite by the afternoon. The agent can then spend thousands of dollars in tokens polishing it, expanding its test suite, and making the wrong idea increasingly difficult to abandon. Comprehensive tests prove that the thing behaves as specified, not that you specified the right thing.

This is why systems thinking becomes more important in the agentic coding era. We may spend less time reasoning about each individual line of code, but we have to spend more time reasoning about the system those lines create.

[Donella Meadows' *Thinking in Systems*](https://www.penguinrandomhouse.com/books/801035/thinking-in-systems-by-donella-meadows/) is one of the books I find myself recommending most often. Meadows describes systems in terms of stocks, flows, feedback loops, delays, resilience, and boundaries. These ideas come from systems dynamics, but they map almost suspiciously well onto event-driven software.

{% include figure.html
    filename="reading-thinking-in-systems-on-vacation.jpg"
    alt="A copy of Donella Meadows' Thinking in Systems held in front of the ocean at sunset."
    description="Me reading a systems thinking book on a beach in California, because I am a huge dork."
%}

A message queue is a stock. Producers create an inflow and consumers create an outflow. If messages arrive faster than consumers process them, the stock grows, no matter how elegant the consumer's dependency injection configuration is. Autoscaling is a delayed feedback loop. Retries can become a reinforcing loop: failures create more work, the added load puts pressure on the unhealthy dependency, and that pressure produces more failures. A dead-letter queue is another stock, useful only if something eventually drains it.

This is where I think a human software architect creates the most value. The architect is responsible for thinking critically about the system as a whole: not merely whether each component is well written, but whether those components collectively solve the right problem under load and in the presence of concurrency and failure. Before asking an agent for implementation, the architect should document the proposed design explicitly:

- The system's purpose and boundaries.
- Its delivery semantics, idempotency strategy, and event ordering guarantees.
- Its concurrency model, coordination boundaries, and potential race conditions.
- Its important stocks, flows, feedback loops, and delays.
- Its failure and recovery behavior.
- Its operational signals and owner.

The human architect does not have to answer those questions alone, but they do have to bear responsibility for the answers. They should turn the design into a rough collaborative artifact and [socialize it with the team](/2025/07/31/build-software-like-a-sitcom-writers-room/) while it is still easy to change. The people who will build and operate the system should have the opportunity to beat the proposal, contribute constraints, expose assumptions, and identify failure modes the architect missed. The architect remains responsible for synthesizing that feedback into a coherent design.

This separates architectural judgment from abundant typing. Agents make it easier than ever to build the thing right. The human architect's systems thinking is how we build the right thing first.

## Build for Operations

Operational ownership is not a reason to avoid building in-house. It is part of what has to be built.

An owned component is not complete when it processes the happy path. An operator needs to see its backlog, throughput, latency, retries, failures, and dead-letter volume. Alerts need thresholds and owners. Recovery procedures need to be written down, and dependency upgrades and compatibility tests need to belong to somebody. The dashboard, alert, runbook, and upgrade path are deliverables alongside the package.

Agents are unusually good at installing this plumbing because much of it is repetitive and declarative. An agent can add traces, metrics, and structured logs with [OpenTelemetry](https://opentelemetry.io/docs/languages/dotnet/), create [Grafana dashboards](https://grafana.com/docs/grafana/latest/visualizations/dashboards/) and alerts, or configure the same telemetry for analysis in [Datadog](https://docs.datadoghq.com/opentelemetry/). It can test that the expected spans and metrics are emitted and keep the deployment configuration beside the implementation instead of leaving observability as a follow-up story nobody prioritizes.

Shared infrastructure should ship with that instrumentation enabled by default. Every consumer should receive the same metrics for backlog, throughput, retries, lease contention, and failures without inventing its own names or dashboards. The application still supplies the business context and routes alerts to an owner, but the difficult operational plumbing is solved once.

Observability is the feedback loop that makes ownership practical. If nobody measures consumer lag, the system cannot react before a customer notices that yesterday's events still have not been processed. Coding agents make the signals inexpensive to produce; systems thinking tells us which signals describe the health of the system.

Do not count the savings from replacing a managed product while leaving its operational features out of the estimate. Have the agent build those features into the replacement and include them in its definition of done.

## Build It Once

The easiest way to lose the economic benefit of agentic coding is to reinvent the same infrastructure in every repository.

Ask ten repositories to add scheduled background work and you may get ten competent PostgreSQL-backed schedulers, each with slightly different lease behavior, retry semantics, metrics, and shutdown handling. The code was cheap to generate; now every copy has to be understood, secured, upgraded, and debugged independently.

That duplication has two prices. The first is the familiar maintenance cost of owning ten implementations. The second is the token cost of asking ten agents to inspect ten repositories, rediscover the same requirements, reason through the same concurrency problems, generate the same scaffolding, and run variations of the same tests.

Those costs are receiving more scrutiny. The Associated Press recently reported that corporate enthusiasm for [“tokenmaxxing” is giving way to a search for cheaper AI and clearer returns](https://apnews.com/article/ai-token-openai-anthropic-corporate-31bb80ac1cd7862d05f6397177d826b1). Some businesses have seen token costs double almost every other month and are beginning to route ordinary tasks to cheaper models instead of using the most capable model for everything.

Treating every coding task as interchangeable token consumption misses how recently models became capable enough to do serious software engineering at all. It is frustrating to push developers into that new way of working and then, as soon as it becomes productive, tell them to retreat to less capable models because the tokens cost too much. The model may be cheaper per request, but the engineering work is not necessarily cheaper after a developer supplies more context, corrects more mistakes, retries failed approaches, and supervises a task the stronger model could have completed.

The better response is not a blanket downgrade. It is to stop paying any model to solve the same problem repeatedly. When several services need the same difficult infrastructure behavior, concentrate the investment. Let the best model reason deeply about lease expiry, idempotency, shutdown, and compatibility. Run the adversarial tests, benchmark the result, review it carefully, and document it. Once those decisions live in a package, a less expensive model in a consumer repository only needs to find the package, understand its [deliberately boring public API](/2024/04/09/projects-are-interfaces/), and wire it into the application.

That turns expensive-model tokens into a capital investment rather than a recurring expense. The organization is not merely buying an answer to today's prompt; it is buying a tested artifact that every future team and agent can reuse. Spend capable-model tokens where capability changes the quality of the result, preserve that result in software, and reserve cheaper models for the genuinely routine work around it.

Make the shared solution easy for agents to discover. Put it in the organization's package catalog, mention it in repository instructions, and ship useful documentation with the code. I have written before about [using documentation as instructions for coding agents](/2026/08/06/some-assembly-required-using-doc-comments-as-agent-instructions/); a reusable library only saves tokens when the agent knows it exists and can understand how to use it.

The useful boundary is between [application policy and infrastructure mechanism](/2016/01/15/living-in-the-problem-domain/). The rule for deciding *which* orders need reconciliation belongs in the application. The machinery ensuring that a reconciliation job is leased to one host, retried safely, observable, and drained during shutdown belongs in a shared component.

A shared library can become its own small piece of critical infrastructure:

<figure class="figure w-100">
    <a href="https://xkcd.com/2347/">
        {% include responsive-image.html
            src="/content/images/xkcd-dependency.png"
            alt="A precarious tower labeled as modern digital infrastructure balanced on one small block maintained by a person in Nebraska."
            class="figure-img img-fluid rounded mx-auto d-block"
            sizes="385px"
            loading="lazy"
        %}
    </a>
    <figcaption class="figure-caption text-center">
        <a href="https://xkcd.com/2347/">“Dependency”</a> by Randall Munroe, licensed under
        <a href="https://creativecommons.org/licenses/by-nc/2.5/">CC BY-NC 2.5</a>.
    </figcaption>
</figure>

The classic xkcd comic shows all of modern digital infrastructure balanced on a small project maintained by one person in Nebraska. Coding agents make that small block easier to create; they do not make the tower resting on it weigh any less.

Give the shared package an owner, versioning, release notes, documentation, telemetry, and compatibility tests. Every new consumer amortizes the original investment and increases the [blast radius](/2024/04/07/organizing-your-code-to-minimize-the-blast-radius/) of a mistake. Recognize when a library has become [load-bearing](/2023/09/13/load-bearing-spreadsheet/) and maintain it accordingly.

A good engineer knows that the [best performance optimization is avoiding unnecessary work](/2017/11/07/the-pit-of-poor-performance-part-2/). The same principle applies to AI costs: the cheapest token is the one you never spend because the answer already exists as a reusable, tested artifact.

## Own More of the Stack

Defaulting to rent was rational when implementing, hardening, documenting, and operating a tailored alternative was prohibitively expensive. That premise has changed. For narrow infrastructure behavior built on mature commodity systems, my new default is to ask how we can own it once and reuse it, not which managed product we can bend the application around.

The playbook is consistent:

- Model the system before generating the implementation.
- Assemble it from mature libraries and foundations such as Kafka or PostgreSQL.
- Prove failure and recovery behavior against real disposable dependencies.
- Ship telemetry, dashboards, alerts, runbooks, and upgrade tests with the code.
- Put the result in a shared package with a named owner and make it discoverable to agents.
- Spend capable-model tokens on the reusable component, then route routine integration work to cheaper models when the task genuinely fits them.

This is not an argument for recreating databases, drivers, encryption mechanisms, security protocols, consensus algorithms, or globally distributed platforms from scratch. It is an argument for replacing recurring managed-service costs with reusable internal code where a narrow layer on cheaper commodity infrastructure can provide the behavior the organization actually uses.

Managed products now have to earn their rent. Operational guarantees, specialized expertise, scale, or a valuable ecosystem can justify the premium. Avoiding a manageable amount of code no longer does.

The old Not Invented Here mechanic built an untested tire out of whatever happened to be lying around. The agentic mechanic buys proven parts and directs a staff equipped with a design review, a test track, an instrumented workshop, and a parts catalog shared by every garage in the company.

We should put that shop to work. Use proven components, especially for security-critical behavior. Build the narrow internal capability once, harden it, operate it on cheaper infrastructure, and share it. For a growing class of infrastructure, owning is now the better deal.
