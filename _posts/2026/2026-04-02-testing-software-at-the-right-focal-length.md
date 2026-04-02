---
layout: post
title: Testing Software at the Right Focal Length
categories: [Software]
image: content/images/testing-focal-length.jpg
---

I've noticed that conversations about testing tend to go sideways almost immediately. Someone says "we need more tests" and the room splits into factions — the unit test purists, the integration test pragmatists, the people who just want to click through the app in a browser and call it a day. Everyone's arguing about which type of test is *best*, as if that's a meaningful question. It's like arguing about whether a macro lens is better than a wide-angle. Better for *what*?

In photography, focal length determines what's in your frame. Zoom in and you see the texture of a single leaf. Zoom out and you see the whole forest. Neither shot is wrong — they're answering different questions. Software tests work the same way. Every test has a *subject under test* — the thing you're pointing the lens at. What changes between test types isn't the rigor, it's the zoom level. How much of the system is in the frame?

## Unit Tests: The Macro Lens

{% include figure.html filename="testing-focal-length-macro.jpg" description="One thing. Does it work?" %}

A macro lens fills the entire frame with one thing. A single gear tooth. A single solder joint. Everything else is gone — not because it doesn't matter, but because right now you're not looking at it.

Unit tests do the same thing. One function, one method, one class — isolated as completely as possible from everything around it. Dependencies get replaced with fakes (mocks, stubs, test doubles), and this trips people up sometimes. It feels like cheating. It's not. It's the whole point. The moment you let a real database connection into the frame, you're no longer testing one thing. You're testing one thing *plus* whether the database is up, whether the connection string is right, whether someone else's migration ran. That's a different photograph entirely.

This is where you catch the dumb stuff that would otherwise waste hours: a function that returns the wrong value for a specific input, a null reference nobody thought about, a business rule that calculates something slightly wrong. In my experience, the boring bugs are the expensive ones, and unit tests are great at finding boring bugs.

**xUnit** is the standard framework in .NET. Pair it with **Moq** or **NSubstitute** for mocking. In Node, **Jest** or **Vitest** handle both the testing and the mocking in one package.


## Integration Tests: The Portrait Lens

{% include figure.html filename="testing-focal-length-portrait.jpg" description="The subject is sharp. The background is there — just not the point." %}

A portrait lens keeps the subject sharp but lets the world around it soften — just enough context to know where you are without it taking over the shot. You're aware there's a background. You're not pretending it doesn't exist. But it's not what you're here for.

Integration tests make the same trade. Now the subject under test is a cluster of things working together. Does the data layer talk to the service layer correctly? Does the message queue handler do the right thing when a message actually arrives? You're no longer testing a single component in a vacuum — you're testing the seams between components, which is where a surprising number of real-world bugs live.

I want to be precise about scope here, because "integration test" is one of those terms that means something different to everyone in the room. There's a common assumption that integration tests must involve real databases, real credentials, real external services talking to each other over the wire. I'd argue that's closer to a readiness test, and it belongs much further out on the zoom. What I mean by integration is integrating the parts *of a single service*. The containerized dependencies you get from .NET Aspire or Testcontainers aren't a shortcut around "real" testing — they're the design. A controlled, reproducible, ephemeral environment means your tests aren't secretly dependent on whatever another team is deploying to a shared dev database at 2am on a Thursday.

This is where you catch the bugs that make you question your career: two components that work perfectly in isolation but pass data in incompatible formats, a database query that works against mocked data but blows up against a real schema, serialization issues that only surface when objects actually cross a process boundary.

For .NET, **.NET Aspire** with `DistributedApplicationTestingBuilder` lets you spin up containerized databases, queues, and whatever else you need for the duration of the test run, then tear it all down. **Testcontainers** does the same thing without the full Aspire stack. In Node, **Jest** or **Vitest** paired with Docker Compose will get you there.


## Acceptance Tests: The Telephoto Lens

{% include figure.html filename="testing-focal-length-telephoto.jpg" description="Out in the real world now. Still pointed at one specific thing." %}

A telephoto lens lets you observe from a distance. You're still pointed at a specific subject — *that* building, *that* person — but you're no longer inches away. You're across the street. The world around the subject is real, not mocked or containerized or controlled.

Acceptance tests are the same move. The subject under test is a specific user-facing behavior, exercised through a real interface: a browser, an API endpoint, a CLI. Does clicking *Add to Cart* actually add the item? Does the checkout flow complete for this particular workflow? You're asking pointed questions, but you're asking them against a running system.

This is where you define acceptance criteria — actual, concrete, "the product owner will sign off on this" criteria — and verify them. The test is written from the outside looking in. It doesn't know or care about your internal architecture. It only knows what a user would know, which is exactly the constraint that makes these tests valuable.

**Playwright** (`Microsoft.Playwright` for .NET, `@playwright/test` for Node) is my recommendation for UI acceptance tests. If your team writes BDD-style specifications, **Reqnroll** (the maintained fork of SpecFlow) wires Gherkin scenarios to Playwright or an HTTP client. For API-level testing in Node, **Supertest** is solid.


## End-to-End Tests: The Wide-Angle Lens

{% include figure.html filename="testing-focal-length-wide.jpg" description="Everything in the shot. Nothing cropped out." %}

A wide-angle lens fits everything in the frame. Every house, every yard, every street. Nothing is cropped out.

End-to-end tests do the same thing. The subject under test is the entire system — every service, every integration, every real dependency — exercised the way a real user would use it. Can a real person actually complete this workflow, end to end, against real infrastructure? This is where you find the bugs that only exist in the spaces between teams: a timing issue that surfaces under real network latency, two services that each passed their own test suites but disagree on a contract, a permissions problem that only manifests in production-like environments.

Here's the thing, though: this is also the zoom level where tests are slowest, most brittle, and hardest to diagnose when they fail. A failing end-to-end test tells you *something* is broken. It rarely tells you *what*. That's not a reason to skip them — it's a reason to be deliberate about them. A small number of E2E tests covering your critical paths will almost always give you more confidence than a large suite that's constantly flaking out and training your team to ignore failures.

**Playwright** and **Cypress** both work here (Cypress is Node-native with a particularly nice developer experience). If you need to layer in load or performance testing, **k6** or **Artillery** can extend the picture.


## The Zoom Is the Point

I keep coming back to this Joe Armstrong quote. Armstrong, the creator of Erlang, had a famous complaint about object-oriented languages: *"You wanted a banana but what you got was a gorilla holding the banana and the entire jungle."* The same trap exists in testing. Every time you reach for a real credentials file, a real external API, a real shared database when a controlled dependency would do — you're inviting the gorilla. Your test now depends on network latency, on that other team not pushing a breaking change, on a specific record existing in a database that someone might clean up overnight.

The intentional scoping at each zoom level isn't a limitation. It's the whole design.

The mistake isn't picking the wrong lens — it's only owning one. A codebase covered entirely in unit tests is a house where every individual drawer slides perfectly and the whole cabinet falls apart when you assemble it. A codebase covered entirely in end-to-end tests is one where every bug requires a full-system investigation to find. You need both, and the stuff in between.

Know what you're testing. Know how much of the world needs to be in the frame to test it honestly. Then pick the right lens.
