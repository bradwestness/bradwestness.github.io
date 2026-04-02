---
layout: post
title: Testing Software at the Right Focal Length
categories: [Software]
image: content/images/testing-focal-length.jpg
---

Conversations about testing tend to go sideways almost immediately. Someone says "we need more tests" and the room splits into factions: the unit test purists, the integration test pragmatists, the people who just want to click through the app in a browser and call it a day. Everyone argues about which type of test is *best*, as if that's a meaningful question. It's like a photographer arguing about whether a macro lens is better than a wide-angle. Better for *what*?

In photography, focal length determines what's in your frame. Zoom in and you see the texture of a single leaf. Zoom out and you see the whole forest. Neither shot is wrong; they're answering different questions. Software tests work the same way. Every test has a *subject under test*, the thing you're pointing the lens at. What changes between test types isn't the rigor, it's the zoom level. How much of the system is in the frame?

## Unit Tests: The Macro Lens

{% include figure.html filename="testing-focal-length-macro.jpg" description="Just the veins. You're not testing the whole leaf, just the plumbing inside it." %}

A macro lens fills the entire frame with one thing. A single gear tooth. A single solder joint. Everything else is gone, not because it doesn't matter, but because right now you're not looking at it.

Unit tests do the same thing. One function, one method, one class, isolated from everything around it. Dependencies get replaced with fakes (mocks, stubs, test doubles). If you were building a house, this is pulling a single kitchen drawer open and closed to make sure the slides work.

This is where you catch the dumb stuff that would otherwise waste hours: a function that returns the wrong value for a specific input, a null reference nobody thought about, a business rule that calculates something slightly wrong. The boring bugs are the expensive ones, and unit tests are great at finding boring bugs.

The trade-off is real, though. A mock tells you what you *told* it to say, not what the real dependency would say. Your test might assume the cache always returns a hit, so you never discover what happens on a miss. A fake HTTP client might hand back a clean object, hiding the serialization issue that blows up when the real service returns a field you didn't expect. Unit tests verify logic in isolation, but the things they can't see are exactly the things that bite you in production.

**xUnit** is the standard framework in .NET. Pair it with **Moq** or **NSubstitute** for mocking. In Node, **Jest** or **Vitest** handle both the testing and the mocking in one package.


## Integration Tests: The Portrait Lens

{% include figure.html filename="testing-focal-length-portrait.jpg" description="The whole leaf now; stem, veins, edges all working together. The tree's back there somewhere, but it's not what you're focused on." %}

A portrait lens keeps the subject sharp but lets the world around it soften. Just enough context to know where you are without it taking over the shot. You're aware there's a background. You're not pretending it doesn't exist. But it's not what you're here for.

Integration tests make the same trade. The subject under test is a cluster of things working together. Does the data layer talk to the service layer correctly? Does the message queue handler do the right thing when a message actually arrives? You're testing the seams between components, which is where a surprising number of bugs live. Back to the house: this is opening all the kitchen drawers to make sure they don't collide with each other or the cabinet doors.

I want to be precise about scope here, because "integration test" means something different to everyone in the room. I think it's the word "integration" itself that trips people up; it sounds like it must mean the service integrating with other real services and external dependencies. But that's closer to a readiness test, and it belongs much further out on the zoom. What I mean by integration is all the component parts of a single service interacting with *each other*. The containerized dependencies you get from .NET Aspire or Testcontainers aren't a shortcut around "real" testing; they're the design. A controlled, reproducible, ephemeral environment means your tests aren't secretly dependent on whatever another team is deploying to a shared dev database at 2am on a Thursday.

This is where you catch the bugs that make you question your career: two components that work fine in isolation but pass data in incompatible formats, a database query that works against mocked data but blows up against a real schema, serialization issues that only surface when objects cross a process boundary.

For .NET, **.NET Aspire** with `DistributedApplicationTestingBuilder` lets you spin up containerized databases, queues, and whatever else you need for the duration of the test run, then tear it all down. **Testcontainers** does the same thing without the full Aspire stack. In Node, **Jest** or **Vitest** paired with Docker Compose will get you there.


## Acceptance Tests: The Telephoto Lens

{% include figure.html filename="testing-focal-length-telephoto.jpg" description="One tree, real soil, real weather. You're still pointed at a specific thing, but the environment isn't faked." %}

A telephoto lens lets you observe from a distance. You're still pointed at a specific subject, *that* building, *that* person, but you're no longer inches away. You're across the street. The world around the subject is real, not mocked or containerized.

Acceptance tests work the same way. The subject under test is a specific user-facing behavior, exercised through a real interface: a browser, an API endpoint, a CLI. Does clicking *Add to Cart* actually add the item? Does the checkout flow complete? You're asking pointed questions against a running system. In the house, this is checking whether the fridge actually gets cold; it requires real wiring, a real outlet, and a real power grid.

This is where you define acceptance criteria, the concrete "the product owner will sign off on this" kind, and verify them. The test is written from the outside looking in. It doesn't know or care about your internal architecture. It only knows what a user would know, and that constraint is what makes these tests valuable.

**Playwright** (`Microsoft.Playwright` for .NET, `@playwright/test` for Node) is my recommendation for UI acceptance tests. If your team writes BDD-style specifications, **Reqnroll** (the maintained fork of SpecFlow) wires Gherkin scenarios to Playwright or an HTTP client. For API-level testing in Node, **Supertest** is solid.


## End-to-End Tests: The Wide-Angle Lens

{% include figure.html filename="testing-focal-length-wide.jpg" description="The whole forest. If something's broken in here, good luck figuring out which tree it is." %}

A wide-angle lens fits everything in the frame. Every house, every yard, every street. Nothing is cropped out.

End-to-end tests do the same thing. The subject under test is the entire system, every service, every dependency, exercised the way a real user would use it. In house terms, you're running every shower, flushing every toilet, turning on every appliance, and checking that the plumbing and electrical all hold up at once. Can someone actually complete this workflow against real infrastructure? This is where you find the bugs that live in the spaces between teams: a timing issue that surfaces under real network latency, two services that each passed their own test suites but disagree on a contract, a permissions problem that only shows up in production-like environments.

This is also where tests are slowest, most brittle, and hardest to diagnose. A failing end-to-end test tells you *something* is broken. It rarely tells you *what*. The automated scripts tend to be so brittle and complex that many teams just run these tests manually: a human clicking through the critical paths before a release. That's not a failure of discipline. An automated E2E suite nobody trusts is worse than a manual checklist people actually run.

If you do automate them, be deliberate about it. A small number of E2E tests covering critical paths will give you more confidence than a large suite that's constantly flaking out and training your team to ignore failures.

**Playwright** and **Cypress** both work here (Cypress is Node-native with a particularly nice developer experience). If you need to layer in load or performance testing, **k6** or **Artillery** can extend the picture.


## Zooming In Is the Point

> The problem with object-oriented languages is they've got all this implicit environment that they carry around with them. You wanted a banana but what you got was a gorilla holding the banana and the entire jungle.
>
> — Joe Armstrong, creator of Erlang

Armstrong was talking about object-oriented languages, but the same trap exists in testing. Every time you reach for a real credentials file, a real external API, a real shared database when a controlled dependency would do, you're inviting the gorilla. Intentional scoping isn't a limitation. It's the whole design.

The mistake isn't picking the wrong lens; it's only owning one. A house where every drawer was tested individually but nobody checked if they collide isn't ready to live in. Neither is one where the only test is turning everything on at once and seeing what blows up. You need both, and the stuff in between.

Know what you're testing. Know how much of the world needs to be in the frame. Pick the right lens.
