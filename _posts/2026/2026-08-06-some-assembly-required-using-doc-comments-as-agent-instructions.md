---
layout: post
title: "Some Assembly Required: Using Doc Comments as Agent Instructions"
categories: [Software, Programming, .NET]
image: content/images/some-assembly-required.png
image_alt: Two panels of wordless IKEA-style assembly instructions. In the first, a figure holding the instruction booklet stands over an unassembled panel and board with a question mark above their head. In the second, the same figure phones the IKEA store for help.
---

Anybody who has assembled IKEA furniture knows the story: a wordless booklet, a bag of cam locks, a stamped-metal [hex key](https://en.wikipedia.org/wiki/Hex_key), and a cartoon person who seems inexplicably delighted about their situation. The booklet does a pretty good job of telling you that dowel A goes in hole B.

What it doesn't tell you is that you're going to want a real screwdriver for step 14, that you should assemble the thing in the room where it's actually going to live, and that if you're anchoring it to drywall, the anchors are not in the box.

The more irritating failure happens when you're on step 13, both side panels are up, and the shelf is finally standing. Then you notice the note in the margin: *before joining panels C and D, insert the cam locks from step 2.* The information was in the booklet, but by the time you found it you had already done the thing it was supposed to prevent.

I've started thinking about [XML documentation comments](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/) in much the same way. The useful comments explain the pieces that aren't included with the library, or put a warning where somebody will see it before they make a hard-to-reverse decision. This has become more important now that a coding agent may be the first consumer to read them.

I don't think every public method needs a usage example. The signature already tells a reader what goes in and what comes back, and an agent can parse types without any help from you. A `<summary>` that says "Gets the job name" on a property called `JobName` is pure noise. Fill a library with enough of those and everybody learns to skim past the one comment that actually mattered.

I try to concentrate on what somebody is likely to get *wrong*: a required piece that lives outside the package, an easy-to-misread option, or a choice whose consequences aren't obvious from the signature. The booklet doesn't need to explain what a screw is. It needs to tell you which face of the panel goes outward, because that's the mistake that makes you take the whole thing apart again.

## Nobody Reads the Wiki

When I publish an internal NuGet package, I write a README. I write a `docs/` folder. I've been known to write a whole [mkdocs](https://www.mkdocs.org/) site with a getting-started page and a troubleshooting page and everything.

Then a teammate points an agent at a consumer repo and says "add a nightly cleanup job to this service," and I get to find out whether any of that documentation actually mattered.

The agent has the package restored into `~/.nuget/packages`, along with my assembly and possibly my documentation XML. It can see whatever the language server returns when it hovers a symbol. It usually can't see my wiki, because nothing in the consumer's repo points to it.

Somebody usually finds the troubleshooting page during the same week the thing starts misbehaving in production. They read it with the incident channel open in another window, and every item on it is a step-13 note: *before deploying, you should have…* The page may have been perfectly accurate, but it wasn't anywhere near the person making the decision.

Documentation in a separate wiki only helps if somebody remembers to go looking for it. Most workflows, human or otherwise, don't make a detour through the wiki before the code gets written. Doc comments travel with the package and appear in the tooltip while somebody is actually typing the call, which is about as good a chance as documentation ever gets to be read at the right time.

That was always a good reason to write doc comments. Coding agents have raised the stakes a bit: the comment may determine whether the agent wires the library up correctly on its first attempt or writes something that compiles, passes its tests, and quietly does nothing.

Of course, the comments only travel with the package if you turn on the relevant MSBuild settings.

## Meet Acme.Scheduler

Let's say you're writing an in-house library called `Acme.Scheduler`, which runs cron-scheduled jobs inside your service host — the [Quartz.NET](https://www.quartz-scheduler.net/) or [Hangfire](https://www.hangfire.io/) model. You register it, you register jobs against cron expressions, and it fires them:

```csharp
services.AddAcmeScheduler(configuration)
    .AddJob<NightlyReconciliationJob>("0 0 3 * * *");   // your code, every day at 3am

services.AddOpenTelemetry()
    .AddAcmeSchedulerMetrics();                          // optional: duration, failures, misfires
```

I'll use four behaviors from this imaginary library throughout the examples:

- **It fires jobs on a cron schedule**, and those expressions are evaluated in UTC.
- **It drains on shutdown.** On `SIGTERM` it stops scheduling new runs and waits for in-flight jobs to finish.
- **It doesn't coordinate unless you tell it to.** By default every host schedules independently; point it at a lock store and only one instance runs a given job.
- **It reports.** Job metrics go to a [StatsD](https://en.wikipedia.org/wiki/StatsD)-style agent over a [Unix domain socket](https://en.wikipedia.org/wiki/Unix_domain_socket), with every instrument name prefixed by the owning team's name from configuration.

In each case, writing the C# is pretty easy. The trouble comes from configuration or deployment details that aren't visible at the call site. I'd wager a scheduling library you actually use has some version of all four.

## Ship the Booklet

By default, the C# compiler doesn't include your doc comments in the compiled output. You have to ask it to generate and package them.

Three properties, which can either go in a .csproj file or in a `Directory.Build.props` file so they apply to every project in the folder:

```xml
<Project>

  <PropertyGroup>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <EmbedAllSources>true</EmbedAllSources>
    <DebugType>embedded</DebugType>
  </PropertyGroup>

</Project>
```

`GenerateDocumentationFile` emits an `Acme.Scheduler.xml` next to the `.dll`, and `dotnet pack` picks it up automatically. That XML file is what IntelliSense reads and what a hover request through the [language server](https://en.wikipedia.org/wiki/Language_Server_Protocol) returns. If you leave it off, consumers only get the bare signature.

People are more likely to skip `EmbedAllSources` with `DebugType` set to `embedded`. These settings put your source files into the PDB and the PDB into the assembly. "Go to Definition" from a consumer's editor can then open the real code, including its comments, instead of a decompiled stub.

That matters more than it sounds like it does, because the documentation XML only carries your `///` comments. It does not carry the ordinary `//` comments *inside* your method bodies, and those are frequently where the actual reasoning lives:

```csharp
// Anchored to the previous scheduled time, not to UtcNow. Anchoring to "now" would let each run's
// own execution time push the next one later, so a 3am job creeps to 3:47am over a few months.
// Nobody notices until someone asks why two daily reports disagree.
var nextFireUtc = this.cron.GetNextOccurrence(previousScheduledUtc);
```

Without embedded sources, an agent that goes looking for that gets correct signatures and zero intent. With them, it gets the reason, and stops trying to "simplify" the line.

> If `GenerateDocumentationFile` is off, that `<remarks>` block you spent twenty minutes writing exists only in the source repository. It's a bit like writing the manual and leaving it on the loading dock.

## The Hardware that Isn't in the Box

The comments I find most useful cover requirements that can't be included in the NuGet package. I basically never used to write these.

Take the shutdown drain. `Acme.Scheduler` does the right thing on `SIGTERM`: it stops scheduling and waits for the running job to finish. Kubernetes, meanwhile, waits `terminationGracePeriodSeconds` — thirty by default — and then sends `SIGKILL` regardless of who is waiting for what.

So a nightly reconciliation job that takes four minutes is fine for weeks, and then somebody deploys at 3:02am and the job is killed halfway through. No exception. No failed health check. The pod exits 0, because from Kubernetes' point of view it did exactly what it was told. The only symptom is a job that "sometimes doesn't finish," which is the worst kind of bug report to receive.

The library cannot fix this, and it cannot ship the fix either. So the fix goes in the doc comment:

```csharp
/// <remarks>
/// <b>Most of what makes this work lives outside the package.</b> Two pod-level settings are required and
/// neither can ship in the package.
/// <para>
/// <b>1. Graceful shutdown.</b> On <c>SIGTERM</c> the scheduler stops triggering and waits for in-flight jobs,
/// but Kubernetes only waits <c>terminationGracePeriodSeconds</c> (default 30) before <c>SIGKILL</c>. Set it
/// above your longest job's runtime or long jobs are killed mid-run on every deployment, with no exception and
/// a zero exit code.
/// </para>
/// <para>
/// <b>2. The metrics socket.</b> The agent's Unix socket has to be mounted and an environment variable has to
/// reach the container; without them submissions are discarded with no error and the service looks healthy.
/// </para>
/// <para>
/// <b>Troubleshooting</b> when metrics do not appear: confirm <c>/var/run/acme/agent.socket</c> exists in the
/// pod; look for this exporter's warning log; then check <c>statsd.client.packets_dropped</c>.
/// </para>
/// </remarks>
/// <example>
/// The registration — scheduler first, then the metrics reader:
/// <code><![CDATA[
/// services.AddAcmeScheduler(configuration)
///     .AddJob<NightlyReconciliationJob>("0 0 3 * * *");
///
/// services.AddOpenTelemetry()
///     .AddAcmeSchedulerMetrics();
/// ]]></code>
/// The pod spec carrying both required settings. Raise the grace period past your longest job:
/// <code><![CDATA[
/// spec:
///   terminationGracePeriodSeconds: 600   # must exceed the longest job's runtime
///   containers:
///     - name: myservice
///       env:
///         - name: ACME_STATSD_SOCKET
///           value: /var/run/acme/agent.socket
///       volumeMounts:
///         - name: agent-socket
///           mountPath: /var/run/acme
///           readOnly: true
///   volumes:
///     - name: agent-socket
///       hostPath:
///         path: /var/run/acme/
/// ]]></code>
/// The Dockerfile line for the span half. This makes the tracer consume <c>ActivitySource</c> spans; it is
/// unrelated to metrics, and metrics need this reader precisely because that bridge does not cover
/// <c>Meter</c>:
/// <code><![CDATA[
/// ENV TRACE_OTEL_ENABLED=true
/// ]]></code>
/// </example>
```

A few details in that example are worth pointing out.

Doc comments are XML, so the `<![CDATA[ ... ]]>` wrapper matters. A stray `<`, `&`, or generic type parameter — and there's an `AddJob<T>` right there in the sample — can wreck the generated file or silently mangle the tooltip. I wrap any substantial code sample in CDATA and stop thinking about it.

The stranger part is putting a Kubernetes pod spec and a `Dockerfile` line inside a C# comment. It felt wrong the first time I did it, but that comment is much closer to the consumer than a page in a separate documentation site.

This helps agents even more than it helps people. If you ask an agent to "add a nightly reconciliation job using our scheduler library," it can write a job class and a cron expression that compile and pass every test. It can't deduce a thirty-second Kubernetes grace period from the C# alone. When the pod spec is in the tooltip, the agent has enough information to open the deployment manifest and compare the grace period with the job it just wrote.

## What the Library Can't See

Some library settings only work when the deployment is configured a certain way. These are especially unpleasant when the process can't inspect that deployment configuration and fail at startup.

Coordination is a good example. Out of the box, every host running `Acme.Scheduler` keeps its own schedule. That works fine for a single-instance service, but the nightly reconciliation runs three times as soon as somebody scales the deployment to three pods. So does the nightly customer email.

Every one of those runs *succeeds*: three green jobs, three sets of healthy metrics, and no errors anywhere. You have to configure a lock store so the instances elect one owner per job, or keep the deployment pinned at a single replica.

The library can't detect which situation it's in. The intended number of replicas lives in a Kubernetes `Deployment`, an [HPA's](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) `minReplicas`, or a values file in a pipeline this assembly has never heard of. None of that is visible from inside the process, so startup validation can't help.

The comment should tell the consumer exactly what needs to be checked:

```csharp
/// <para>
/// With no lock store configured, every replica keeps its own schedule and fires every job independently.
/// Verify the deployment's replica configuration in the same change: the replica floor lives outside this
/// codebase — a Kubernetes Deployment's <c>replicas</c>, an HPA's <c>minReplicas</c>, or the deployment
/// pipeline's values file — so this library cannot check it at startup. Whoever registers a job without a
/// lock store (a developer, or an AI agent making the change) must locate that manifest and confirm the
/// deployment runs a single replica, or explicitly flag it for the operator to confirm. An HPA that scales to
/// three pods runs every job three times, and all three runs report success.
/// </para>
```

There are a few reasons I would write all of that instead of stopping at "this may run more than once."

**Name where to look.** "Verify your infrastructure config" doesn't give an agent much to work with. `replicas`, `minReplicas`, and "the deployment pipeline's values file" are grep targets. Concrete names give the agent a reasonable chance of finding the relevant file instead of stopping when the C# looks fine.

**Explain what to do when verification isn't possible.** The line about flagging it for the operator may be the most valuable part of the block. If the repo doesn't contain the manifest, the agent can mention the unresolved check in its summary or PR description. That is much more useful than silently assuming the deployment has one replica.

**Describe the failure mode.** "This can break" is easy to ignore. "The autoscaler adds a pod and every job quietly starts running twice" tells the reader when the problem happens and what to look for. Mentioning that all of the runs report success explains why the ordinary health checks won't catch it.

## Warning Labels

Other problems come from APIs that look self-explanatory but have an easy-to-miss constraint. Agents are very good at finding the obvious method in IntelliSense and writing code that compiles against it, whether or not that code is safe in production. I now use a few patterns for these cases:

**Ordering requirements.** `AddAcmeSchedulerMetrics` resolves a client that `AddAcmeScheduler` registers, so it has to come second. Say that in the `<remarks>`, and also throw an `InvalidOperationException` that names the missing call. The comment helps somebody write it correctly, and the exception catches anybody who doesn't.

**Reasons for deliberate limitations.** If you've deliberately made something rigid, explain why. Otherwise a well-meaning contributor (of any species) may helpfully make it flexible again. For a scheduler, I would put this warning anywhere cron expressions are accepted:

```csharp
/// <para>
/// Cron expressions are always evaluated in <b>UTC</b>. A local-time schedule in a
/// zone with daylight saving has two days a year where it is wrong and silent about it: on the
/// spring-forward boundary a 2am job never fires at all, and on the fall-back boundary it fires twice. If a
/// job must run at a wall-clock local time, convert in the job body and accept the shift.
/// </para>
```

I have [opinions about daylight saving time](/2023/07/17/of-daylight-and-savings/) that predate any of this. This particular mistake happens silently, twice a year, at 2am, and is unlikely to show up in an ordinary test suite. That seems worth a whole paragraph.

**Exceptions with instructions.** This is my favorite one. `Acme.Scheduler` refuses to run two copies of the same job at once, so a manual `TriggerAsync` call while a run is in flight throws `JobAlreadyRunningException`. The exception means the requested job is already in progress, so it shouldn't be handled like a failed job.

A very common response is `catch (Exception) { logger.LogError(ex, "job failed"); alerts.Page(); }`. That turns an impatient double-click into a pageable error even though the original job is still running. I would document the expected handling on the exception type itself:

```csharp
/// <remarks>
/// <b>The requested job is already in flight.</b> Handle this separately from job failures.
/// <list type="bullet">
///   <item><description><b>Do not alert or page on this exception.</b> Catch it specifically, separately from
///     real job faults, or an impatient double-click becomes an incident.</description></item>
///   <item><description><b>Do not retry in a tight loop.</b> The throw is immediate, so a naïve retry busy-waits
///     the CPU for as long as the original run takes. Poll
///     <see cref="IAcmeScheduler.GetStatusAsync"/> instead.</description></item>
///   <item><description>To report progress to a caller, surface the in-flight run's start time from
///     <see cref="StartedUtc"/> rather than reporting a failure.</description></item>
/// </list>
/// </remarks>
```

## Don't Recreate the Whole Wiki

Taken too far, this could produce a library where every method carries four hundred words of prose that nobody maintains. Before writing any of it, I ask: *would somebody competent already know this from reading the signature?* If so, I leave it out. Restating the obvious makes the actual warnings harder to find.

Three more things keep me honest.

**Prefer a throw to a sentence.** If a misconfiguration is detectable, detect it. The registration should fail with a useful message such as `"AddAcmeSchedulerMetrics requires IAcmeTelemetryClient. Call AddAcmeScheduler(configuration) during startup."` An agent can respond to a failing build or test run just as easily as it can read a tooltip, and the exception is less likely to drift away from the behavior than a comment. I save documentation for the things the compiler, constructor, or startup validation can't enforce.

The lock-store example is why comments still matter. Since the process genuinely can't inspect the replica configuration, the warning is the only guidance the package can provide.

> You can take "prefer a throw" even further by shipping a [Roslyn analyzer](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/) in the package, turning misuse into a red squiggle at the call site. It also travels with the package, although you are depending on the consumer's editor or build to surface the analyzer diagnostic.

**One canonical example, referenced from everywhere else.** Overload sprawl is how doc comments rot: you write the good example six times and then update one of them. Put the full `<remarks>` and `<example>` on the primary entry point, and on the rest write `<remarks>See the <see cref="..."/> overload for the full behaviour and caveats.</remarks>` and nothing more.

That rule applies to examples. I put hazard notes on every surface where somebody can set the relevant value — the options property *and* the builder method that assigns it — because a consumer may never touch the one I happened to document first. Duplicating four lines is worthwhile when the bug would make every job run once per pod.

**Document less by exposing less.** I've [banged this drum before](/2024/04/09/projects-are-interfaces/). Every `public` member needs a `<summary>` (CS1591 will make sure you remember), and every one is something an agent may decide to build on. `internal` plus `InternalsVisibleTo` for your test project keeps both the API and its manual small.

## Leave the Instructions with the Parts

For a library package, that means enabling `GenerateDocumentationFile`, `EmbedAllSources`, and `DebugType embedded` so the comments and source make it to the consumer. It also means resisting the urge to explain every obvious property. I would rather have three useful warnings than thirty summaries that repeat their member names.

The useful warnings tend to cover pod specs, grace periods, environment variables, ordering requirements, and other details that can't be inferred from the C#. If the process can detect a bad configuration, fail with a useful message. If it can't, tell the consumer where to look and what to report when the necessary file isn't available.

A coding agent can assemble the bookshelf quickly, but somebody still has to notice that the drywall anchors aren't in the box. Put that note beside the method that needs them, where the next person or agent has a chance of seeing it before step 13.
