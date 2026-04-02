---
layout: post
title: Testing Software at the Right Focal Length
categories: [Software]
image: content/images/testing-focal-length.jpg
---

{% include figure.html filename="testing-focal-length.jpg" description="Different lenses. Different focal lengths. Different pictures." %}

In photography, *focal length* determines what's in your frame. A macro lens fills the shot with a single gear tooth. A wide-angle lens fits an entire neighborhood. Neither is wrong — they're asking different questions.

Software tests work the same way. Every test has a *subject under test*: the thing you're pointing the lens at. What changes between test types isn't the rigor — it's the zoom. How much of the system is in the frame? How much of the world around it?

The right focal length depends on what you're trying to see.

---

## Unit Tests

*The macro lens.*

{% include figure.html filename="testing-focal-length-macro.jpg" description="One thing. Does it work?" %}

A macro lens fills the frame with one thing. A single gear tooth. A single solder joint. Everything else disappears — not because it doesn't exist, but because it's not what you're looking at.

Unit tests work the same way. The subject under test is one function, one method, one class — isolated as completely as possible from everything around it. Think of testing a single kitchen drawer. Does it open? Does it close? Does it stay on its track? You're not asking whether it fits in a cabinet yet. You're not asking whether it can hold silverware for a family of four. You're asking one question, and everything else is out of frame.

Dependencies are replaced with fakes — mocks, stubs, test doubles. This isn't cheating. It's the point. The moment you let a real dependency into the frame, you're no longer testing one thing.

### Technologies you might use

- **xUnit** (.NET) — the standard unit testing framework
- **Moq** or **NSubstitute** (.NET) — for mocking dependencies
- **Jest** or **Vitest** (Node) — unit testing and mocking in one package

### Bugs you might catch

- A function that returns the wrong value for a specific input
- A method that throws when given null instead of handling it gracefully
- Business logic that calculates something incorrectly
- An edge case the original author didn't think about

---

## Integration Tests

*The portrait lens.*

{% include figure.html filename="testing-focal-length-portrait.jpg" description="Both drawers work. Together, they don't." %}

A portrait lens keeps the subject sharp but lets the world around it come into focus — softly, partially, just enough to give context. You know there's a background. You're not pretending it doesn't exist. But it's not the point.

Integration tests work the same way. Now the subject under test is a cluster of things working together. Not two drawers in isolation — two drawers next to each other, in a real cabinet, where the handles might collide. Does the data layer talk to the service layer correctly? Does the message queue handler do the right thing when a message arrives?

A word on scope, because this is where "integration test" tends to get misread. There's a common assumption that integration tests must involve real databases, real credentials, and real external services talking to each other over the wire. That's closer to a readiness test — and it belongs much further out on the zoom. Here, integration means integrating the parts *of a single service*. One kitchen, not the whole restaurant supply chain. The containerized dependencies you get from .NET Aspire or Testcontainers aren't a shortcut — they're the design. A controlled, reproducible, clean-room environment means your tests aren't secretly dependent on what another team is deploying to a shared development database at 2am.

In service-oriented or domain-driven architectures, this is where you test the full message flow: publish a command to the input queue, assert on what ends up in the output queue or the database. The subject is still clearly in frame. The context is real enough to matter.

### Technologies you might use

- **.NET Aspire** (`DistributedApplicationTestingBuilder`) — spin up containerized dependencies (databases, queues, etc.) for the duration of the test
- **Testcontainers** (.NET or Node) — Docker-based ephemeral dependencies without the full Aspire stack
- **Jest** or **Vitest** with real service instances spun up via Docker Compose

### Bugs you might catch

- Two components that work individually but pass data in incompatible formats
- A database query that works in unit tests with mocked data but fails against a real schema
- A message handler that processes events correctly but writes to the wrong table
- Serialization bugs that only surface when objects actually cross a boundary

---

## Acceptance Tests

*The telephoto lens.*

{% include figure.html filename="testing-focal-length-telephoto.jpg" description="Out in the real world now. Still pointed at one specific thing." %}

A telephoto lens lets you observe from a distance. The subject is still specific — you're pointed at *that* storefront, *that* person — but you're no longer inches away. You're standing across the street. The world around the subject is real.

Acceptance tests make the same move. The subject under test is a specific user-facing behavior, exercised through a real interface — a browser, an API endpoint, a command-line tool. Does clicking *Add to Cart* actually add the item? Does the checkout flow complete correctly for *this particular workflow*?

The fridge in the kitchen needs to actually be plugged in now. It's not enough to know the motor works in isolation — you need to know it draws power correctly in a real environment. But you're still testing one specific thing: *does this refrigerator work*, not *can a family live in this house*.

In practice, this is where you define acceptance criteria and verify them against a running instance. The test is written from the outside looking in.

### Technologies you might use

- **Playwright** (`Microsoft.Playwright` for .NET, `@playwright/test` for Node) — browser automation for UI acceptance tests
- **SpecFlow** or **Reqnroll** (.NET) — BDD-style acceptance tests written in Gherkin, wired to Playwright or an HTTP client
- **Supertest** (Node) — HTTP-level acceptance testing against a running API

### Bugs you might catch

- A feature that works in unit and integration tests but breaks when the UI renders it
- A form that submits but doesn't actually save because of a missing wire-up
- An API endpoint that returns 200 but sends the wrong response shape
- A user flow that works in isolation but breaks when a real session cookie is involved

---

## End-to-End Tests

*The wide-angle lens.*

{% include figure.html filename="testing-focal-length-wide.jpg" description="Everything in the shot. Nothing cropped out." %}

A wide-angle lens fits everything in the frame. The whole neighborhood. Every house, every yard, every street. Nothing is cropped out.

End-to-end tests do the same thing. The subject under test is the entire system — every service, every integration, every real dependency — exercised the way a real user would use it. Can a family actually live in this house? Is there water? Heat? Does the internet work? Does the dishwasher drain into the right pipe and not the one connected to someone else's kitchen?

This is the zoom level where you run against real infrastructure, real credentials, real data. It's also the zoom level where tests are slowest, most brittle, and hardest to diagnose when they fail. That's not a reason to skip them — it's a reason to use them deliberately. A small number of end-to-end tests covering critical paths is almost always more valuable than a large number covering everything.

### Technologies you might use

- **Playwright** — the same tool works for E2E as for acceptance, but pointed at a full production-like environment
- **Cypress** — Node-native E2E testing with a particularly ergonomic developer experience
- **k6** or **Artillery** — if you need to add load or performance testing to the E2E picture

### Bugs you might catch

- A workflow that works in every isolated test environment but fails against real infrastructure
- An integration between two services that each passed their own tests but disagree on a contract
- A timing issue that only surfaces under real network latency
- A permissions or credentials problem that only exists in production-like environments

---

## The Zoom Is the Point

Every test type in this post is asking a different question about the same subject. The macro lens asks: does this one thing work? The portrait lens asks: do these things work together? The telephoto lens asks: does this behavior work in the real world? The wide-angle lens asks: does the whole system work for a real user?

The mistake isn't choosing the wrong lens — it's using only one. A codebase covered entirely in unit tests is a house where every individual drawer opens perfectly and the cabinet falls apart when you put it together. A codebase covered entirely in end-to-end tests is one where every defect requires a full system investigation to diagnose.

Joe Armstrong, the creator of Erlang, had a famous complaint about object-oriented languages: *"You wanted a banana but what you got was a gorilla holding the banana and the entire jungle."* The same trap exists in testing. Every time you reach for a real credentials file, a real external API, a real shared database when a controlled dependency would do — you're inviting the gorilla. Your test now depends on network latency, on that other team not pushing a breaking change to the shared dev environment, on a specific record existing in a database that someone might clean up overnight. The intentional scoping at each zoom level isn't a limitation. It's the whole point. Faster feedback. Consistent, reproducible results. No more broken deploys because a neighbor's hotfix touched something you didn't even know you were depending on.

Know what you're testing. Know how much of the world needs to be in the frame to test it. Pick the right lens.