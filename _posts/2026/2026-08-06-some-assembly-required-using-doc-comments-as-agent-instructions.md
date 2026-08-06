---
layout: post
title: Some Assembly Required - Using Doc Comments as Agent Instructions
categories: [Software, Programming, .NET]
image: content/images/some-assembly-required.png
image_alt: Two panels of wordless IKEA-style assembly instructions. In the first, a figure holding the instruction booklet stands over an unassembled panel and board with a question mark above their head. In the second, the same figure phones the IKEA store for help.
---

Anybody who has put together flatpack furniture knows the format: a wordless booklet, a bag of cam locks, a stamped-metal [hex key](https://en.wikipedia.org/wiki/Hex_key), and a cartoon person who seems inexplicably delighted about their situation. The booklet is genuinely good at the thing it's for, which is telling you that dowel A goes in hole B.

What it doesn't tell you is that you're going to want a real screwdriver for step 14, that you should assemble the thing in the room where it's actually going to live, and that if you're anchoring it to drywall, the anchors are not in the box.

Then there's the other kind of failure, which is the one that really stings. You're on step 13. Both side panels are up, the shelf is standing, you're feeling pretty good about it. And there in the margin is a note: *before joining panels C and D, insert the cam locks from step 2.* The information was in the booklet the whole time. It was just behind you.

Those two gaps — between the parts in the box and the parts that aren't, and between when a warning gets written and when it gets read — are where nearly all of the pain lives. They're also, I've come to believe, exactly where you should be spending your [XML documentation comments](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/) now that a coding agent is likely to be the first thing that reads them.

## Nobody Reads the Wiki

When I publish an internal NuGet package, I write a README. I write a `docs/` folder. I've been known to write a whole [mkdocs](https://www.mkdocs.org/) site with a getting-started page and a troubleshooting page and everything.

Then a teammate points an agent at a consumer repo and says "add a nightly cleanup job to this service," and I get to find out how much of that actually mattered.

The agent has the package restored into `~/.nuget/packages`. It has my assembly. It may have my documentation XML. It has whatever the language server will tell it when it hovers a symbol. It does **not** have my wiki, and it is not going to go find it, because nothing in the consumer's repo points at it.

And when somebody *does* eventually find that troubleshooting page, it is almost always the same week the thing is misbehaving in production. They read it with the incident channel open in another window, and every item on it is a step-13 note: *before deploying, you should have…* The page was right. The page was there the whole time. It just wasn't anywhere near where anybody was standing when the decision got made.

That's the whole thing, really. Documentation housed anywhere else is documentation you *hope* gets read. There's no mechanism that makes it happen — no step in anyone's workflow, human or otherwise, that reliably routes through your wiki before the code gets written. Doc comments are different in kind: they ship with the code, so they can't be missed. Not "are more likely to be found" — *can't be missed*, because they arrive in the tooltip at the exact moment somebody is typing the call.

That was always sort of true, and it's why we write them at all. But it used to be a convenience — a nicer tooltip, a small kindness to your future self. Now it's the difference between an agent that wires your library up correctly on the first attempt and one that writes something that compiles, passes, and quietly does nothing.

The catch, and the reason for the next section, is that "ship with the code" is conditional on about four lines of MSBuild.

## Meet Acme.Scheduler

Every example below comes from the same invented package, so it's worth thirty seconds establishing what the thing does.

`Acme.Scheduler` runs cron-scheduled jobs inside your service host — the [Quartz.NET](https://www.quartz-scheduler.net/) or [Hangfire](https://www.hangfire.io/) slot in a solution. You register it, you register jobs against cron expressions, and it fires them:

```csharp
services.AddAcmeScheduler(configuration)
    .AddJob<NightlyReconciliationJob>("0 0 3 * * *");   // your code, every day at 3am

services.AddOpenTelemetry()
    .AddAcmeSchedulerMetrics();                          // optional: duration, failures, misfires
```

Four of its behaviors come up over and over below, so here they are once, in advance:

- **It fires jobs on a cron schedule**, and those expressions are evaluated in UTC.
- **It drains on shutdown.** On `SIGTERM` it stops scheduling new runs and waits for in-flight jobs to finish.
- **It doesn't coordinate unless you tell it to.** By default every host schedules independently; point it at a lock store and only one instance runs a given job.
- **It reports.** Job metrics go to a [StatsD](https://en.wikipedia.org/wiki/StatsD)-style agent over a [Unix domain socket](https://en.wikipedia.org/wiki/Unix_domain_socket), with every instrument name prefixed by the owning team's name from configuration.

Every one of those is a spot where the C# is the easy part and the context around it is where people get hurt. I'd wager a scheduling library you actually use has all four.

## Ship the Booklet

Here's the part that can bite you: by default, none of your documentation ships at all. The C# compiler throws your doc comments away unless you ask it not to.

Three properties, which I keep in a `src/Directory.Build.props` so the library projects get them and the sample and test projects don't:

```xml
<Project>

  <PropertyGroup>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <EmbedAllSources>true</EmbedAllSources>
    <DebugType>embedded</DebugType>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>

</Project>
```

`GenerateDocumentationFile` emits an `Acme.Scheduler.xml` next to the `.dll`, and `dotnet pack` picks it up into the package without you asking. That XML file is what IntelliSense reads, what a hover request through the [language server](https://en.wikipedia.org/wiki/Language_Server_Protocol) returns, and therefore what an agent sees when it looks at one of your methods. Leave it off and every consumer — human or otherwise — gets a bare signature and a shrug.

It has a second effect that I've come to like a lot more than I expected: turning it on enables warning CS1591, "missing XML comment for publicly visible type or member." Combined with `TreatWarningsAsErrors`, that means you cannot add a `public` member to the library without documenting it. The build simply won't let you. It's the cheapest documentation gate I know of, and it costs one line.

`EmbedAllSources` with `DebugType` set to `embedded` is the one people skip. It stuffs your actual source files into the PDB, and the PDB into the assembly. Now "Go to Definition" from a consumer's editor lands on your real code — comments, whitespace, and all — instead of a decompiled stub.

That matters more than it sounds like it does, because the documentation XML only carries your `///` comments. It does not carry the ordinary `//` comments *inside* your method bodies, and those are frequently where the actual reasoning lives:

```csharp
// Anchored to the previous scheduled time, not to UtcNow. Anchoring to "now" would let each run's
// own execution time push the next one later, so a 3am job creeps to 3:47am over a few months.
// Nobody notices until someone asks why two daily reports disagree.
var nextFireUtc = this.cron.GetNextOccurrence(previousScheduledUtc);
```

Without embedded sources, an agent that goes looking for that gets correct signatures and zero intent. With them, it gets the reason, and stops trying to "simplify" the line.

> The short version: if `GenerateDocumentationFile` is off, that `<remarks>` block you spent twenty minutes on exists only on your own machine. You wrote the manual and left it on the loading dock.

## The Anchors Aren't in the Box

This is the category I get the most mileage out of, and the one I basically never used to write.

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

A few things about that.

The `<![CDATA[ ... ]]>` wrapper is not decoration. Doc comments are XML, so a stray `<`, `&`, or generic type parameter — and there's an `AddJob<T>` right there in the sample — will wreck the generated file, or just silently mangle what the tooltip shows. Wrap anything with punctuation in CDATA and stop thinking about it.

More importantly: notice that a Kubernetes pod spec and a `Dockerfile` line are sitting inside a C# comment. That feels wrong the first time you do it. It is, in fact, correct, because it's the only place a consumer is guaranteed to be standing when they need it.

And the payoff with an agent is bigger than it is with a person. Ask an agent to "add a nightly reconciliation job using our scheduler library." It'll write a clean job class and a correct cron expression. The build will pass. The tests will pass. It will report success, accurately — and four minutes into the next 3am deploy, the job dies, because an agent cannot deduce a thirty-second grace period by reading C#. Put the pod spec in the tooltip and something different happens: it writes the job, then goes and opens the deployment manifest to check the grace period against the job it just wrote.

> This was already the number one reason people reported that one of my libraries "didn't work," long before any of this. Agents didn't create the problem. They just made it much more obvious that the fix was never a wiki page.

## What the Library Can't See

Everything above is about instructions the package can't *ship*. There's a nastier variant: a setting inside your library whose correctness depends entirely on something outside it, where you don't even get the consolation prize of failing fast.

Coordination is the example. Out of the box, every host running `Acme.Scheduler` keeps its own schedule — which is exactly right for a single-instance service, and catastrophic the moment somebody scales the deployment to three pods. Now the nightly reconciliation runs three times. The nightly customer email goes out three times.

And every one of those runs *succeeds*. Three green jobs, three sets of healthy metrics, no errors anywhere. Either you configure a lock store so the instances elect one owner per job, or the deployment has to stay pinned at a single replica. What you cannot do is have neither.

The library cannot detect which situation it's in. From inside the process there is no way to know how many replicas the deployment intends to run; the number lives in a Kubernetes `Deployment`, or an [HPA's](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) `minReplicas`, or a values file in a pipeline this assembly has never heard of. Startup validation isn't on the table. There is nothing to throw.

So the comment has to do the whole job — and the useful move is not to describe the hazard but to *assign the work*:

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

Three things in there are doing work that a plain description of the hazard wouldn't.

**It names where to look.** "Verify your infrastructure config" is useless to an agent. `replicas`, `minReplicas`, and "the deployment pipeline's values file" are grep targets. Hand an agent three concrete nouns and it will go find the file; hand it a vague gesture at "your deployment" and it will decide the C# looks fine and move on.

**It says what to do when verification isn't possible.** *Or explicitly flag it for the operator to confirm.* That's the most valuable clause in the block. An agent working in a repo that doesn't even contain the manifest now has a defined move that isn't "assume it's fine," and the human gets a line in the PR description instead of a surprise several weeks later. If you write only one instruction for the agent, write the escape hatch.

**It names the failure mode, not just the failure.** Not "this can break," but: the autoscaler adds a pod, and every job in the system quietly starts running twice, and all of it reports success. A warning that describes *when and how* you'll find out is a warning somebody acts on.

A paragraph like that one usually starts life as a comment on a pull request. That's where most of mine come from now. If you have had to explain something to a reviewer once, in prose, that prose belongs in the doc comment — otherwise you will explain it again to the next person, and the person after that, and eventually to nobody, because you'll have moved teams.

## Warning Labels

The second category is things that are *dangerous* rather than merely non-obvious. Agents write code that compiles, enthusiastically, and are perfectly willing to write code that compiles and is catastrophic in production. A few patterns I now reach for:

**Ordering requirements.** `AddAcmeSchedulerMetrics` resolves a client that `AddAcmeScheduler` registers, so it has to come second. Say that in the `<remarks>` — and then also throw an `InvalidOperationException` that names the missing call, so it's impossible to get wrong twice.

**"Not configurable, and here's why."** Anything you've deliberately made rigid needs its reasoning attached, or a well-meaning contributor (of any species) will helpfully make it flexible again. For a scheduler the obvious candidate is the one I'd want tattooed somewhere:

```csharp
/// <para>
/// Cron expressions are evaluated in <b>UTC</b> and that is not adjustable. A local-time schedule in a
/// zone with daylight saving has two days a year where it is wrong and silent about it: on the
/// spring-forward boundary a 2am job never fires at all, and on the fall-back boundary it fires twice. If a
/// job must run at a wall-clock local time, convert in the job body and accept the shift.
/// </para>
```

I have [opinions about daylight saving time](/2023/07/17/of-daylight-and-savings/) that predate any of this, but the relevant part here is "wrong and silent about it." A constraint whose violation is loud can afford a short comment. A constraint whose violation is silent — twice a year, at 2am, in a way no test will ever catch — needs the whole paragraph.

**Exceptions with instructions.** This is my favorite one. `Acme.Scheduler` refuses to run two copies of the same job at once, so a manual `TriggerAsync` call while a run is in flight throws `JobAlreadyRunningException`. That is not a failure. Nothing is broken; the job you asked for is, in the most literal sense, already happening.

The incorrect response, which is also the single most common shape of exception handling in the wild, is `catch (Exception) { logger.LogError(ex, "job failed"); alerts.Page(); }` — which turns "your long job is still going" into a pageable error, reliably, every time an operator gets impatient and clicks the button twice. So the type documents its own handling:

```csharp
/// <remarks>
/// <b>This is not a job failure.</b> The requested job is already in flight; nothing has gone wrong.
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

**Surprising names.** The team prefix, from up top. An instrument the library calls `scheduler.job.duration` arrives at the backend as `platform.scheduler.job.duration`, and *that's* the name a dashboard or monitor definition has to query. An agent writing that monitor will absolutely use the bare name unless you tell it otherwise, and the resulting monitor will look fine and alert on nothing.

## Don't Write the Whole Manual

All of which could easily curdle into a library where every method carries four hundred words of prose that nobody maintains. Three things keep me honest.

**Prefer a throw to a sentence.** If a misconfiguration is detectable, detect it. The best doc comment is the one you can delete outright, because the registration itself now fails with `"AddAcmeSchedulerMetrics requires IAcmeTelemetryClient. Call AddAcmeScheduler(configuration) during startup."` An agent reads a failing build or test run just as happily as it reads a tooltip, and an exception message can't quietly drift out of sync with the code the way a comment can. Documentation is what's left over after you've run out of things the compiler and the constructor can enforce.

The corollary is the lock-store case above: when a constraint genuinely *can't* be checked from inside the process, the comment isn't a fallback for the check you didn't write. It's the only control you have, and it deserves to be written with that much weight.

> The furthest version of "prefer a throw" is shipping a [Roslyn analyzer](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/) in the package, so the misuse is a red squiggle at the call site instead of a paragraph in a tooltip. Same principle — it travels with the package — except now you're depending on the consumer's editor or build actually surfacing analyzer diagnostics, which is a much softer guarantee than "the XML is in the nupkg." That's a whole post of its own, and I'll write it once I've been burned enough times to have opinions.

**One canonical example, referenced from everywhere else.** Overload sprawl is how doc comments rot: you write the good example six times and then update one of them. Put the full `<remarks>` and `<example>` on the primary entry point, and on the rest write `<remarks>See the <see cref="..."/> overload for the full behaviour and caveats.</remarks>` and nothing more.

That rule is about *examples*, though. A hazard note is different: it belongs on every surface where somebody can actually set the value — the options property *and* the builder method that assigns it — because a consumer who never touches the one you documented gets no warning at all. Duplicate the paragraph. It's four lines, and the alternative is every job in the service running once per pod.

**Document less by exposing less.** I've [banged this drum before](/2024/04/09/projects-are-interfaces/), but it lands differently now. Every `public` member is a member you owe a `<summary>` (CS1591 will make sure you remember) *and* a member an agent may decide to build on. `internal` plus `InternalsVisibleTo` for your test project keeps both the surface and the manual small. The narrower the box, the shorter the instructions.

## Read the Flatpack Manual

So, to recap:

- Turn on `GenerateDocumentationFile`, `EmbedAllSources`, and `DebugType embedded`, or your comments never leave your machine. Put them in a `src/Directory.Build.props` so tests and samples stay out of the gate.
- Document the parts that aren't in the box — pod specs, grace periods, environment variables, `Dockerfile` lines, ordering requirements. That's the material no amount of reading your source can reveal.
- Put a warning label on every silent failure. "Looks healthy, does nothing" is the worst outcome available, and it's the one most likely to get shipped by something that can't check a dashboard.
- Explain the reasoning behind anything you've deliberately made rigid, or somebody will helpfully make it flexible.
- When a setting's correctness depends on something the process can't see, name the files to go look in, and say what to do if it can't be confirmed. "Flag it for a human to verify" is a legitimate instruction, and it's the one that saves you.
- Prefer a throw with a good message over a paragraph. Prefer a narrower public surface over both.
- Mine your own PR review comments. Anything you've had to explain twice in review is a doc comment you haven't written yet.

The part that hasn't changed is who writes the instructions. An agent will assemble the bookshelf quickly, in the right room, with the correct dowels in the correct holes, and it will not stop to wonder whether the drywall anchors were in the box. Noticing that they aren't — and that the failure will be silent, and that somebody is going to page you about it at 2am — is still the job. The best you can do is leave a note where whoever comes next is standing when they need it, and be specific about what to do when they can't be sure.

Happy assembling. The hex key is in the bag taped to panel B.
