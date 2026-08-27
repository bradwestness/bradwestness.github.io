---
layout: post
title: Testing Software at the Right Focal Length
categories: [Software]
image: content/images/testing-focal-length.jpg
image_alt: An overhead flat-lay of camera gear on a grey wood floor, with two Canon DSLR bodies surrounded by lenses ranging from a 100mm macro to a 70-200mm telephoto, plus a shotgun microphone and a drone controller.
---

People generally agree that software should have automated tests. The trouble starts when you ask what kind. Nobody seems to agree on exactly what "unit test" means versus "integration test," which tests should use mocked dependencies, or which should talk to real databases and external APIs.

People have strong opinions about which tests are "best" and which are "useless," but this is a bit like a room full of photographers trying to agree on the one correct lens. Should you use a macro lens? A portrait lens? A telephoto lens? Each one has its place; it depends on what you're trying to capture in the frame.

In software testing, the term "[subject-under-test](https://en.wikipedia.org/wiki/System_under_test)" refers to *what* code a given test is meant to exercise. Each type of test is a bit like using a different focal length in a camera lens, starting from extreme close-up (unit tests) to wide-angle (end-to-end and acceptance tests). Different types give you different information about the system, and the subject-under-test changes depending on how much is in frame.

## Unit Tests: The Macro Lens

{% include figure.html filename="testing-focal-length-macro.jpg" description="Unit tests check the individual code paths within a class or method, everything else is abstracted away." %}

A macro lens in photography is used for extreme close-ups, like zooming in on the veins of a leaf, or a single ant. This is a bit like a unit test. In this case, the subject-under-test is a single method or class. You use mocks, fakes, or stubs for literally everything not in that class. This is made easy if you're using [dependency injection](https://en.wikipedia.org/wiki/Dependency_injection) or [inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control) patterns, as you can just inject the fake versions of the subject-under-test's dependencies when running the unit tests, while the actual running service would use real versions.

Unit tests work well for testing [pure functions](https://en.wikipedia.org/wiki/Pure_function) - does this function return the expected output for a given input? Does it map the properties from one object to another as expected? Does it correctly validate the input arguments to prevent bad data from entering the system? You can catch a lot of these types of bugs with unit tests. They're also the easiest to write, fastest to execute, and work well in automated test pipelines as part of a [continuous integration](https://en.wikipedia.org/wiki/Continuous_integration) strategy.

However, because you're so zoomed in on one particular subject, there are whole classes of issues you'll likely miss if you only use unit tests.

[xUnit](https://xunit.net/) is the standard framework in .NET. Pair it with [Moq](https://github.com/devlooped/moq) or [NSubstitute](https://nsubstitute.github.io/) for mocking. In Node, [Jest](https://jestjs.io/) or [Vitest](https://vitest.dev/) handle both the testing and the mocking in one package.


## Integration Tests: The Portrait Lens

{% include figure.html filename="testing-focal-length-portrait.jpg" description="Integration tests check multiple classes or methods working together in concert, even though they are all part of the same whole." %}

A portrait lens in photography is just what it sounds like; it's used for portraits, and it keeps one person sharp while blurring the background a bit to ensure the viewer focuses on the subject.

In software testing, this is like an integration test; we've zoomed out from a single method or single class, and the subject-under-test is now the whole service. Meanwhile, other services and external dependencies are still blurry; you can still use fakes or mocks for them. But we're testing all the components of this one service in concert: does the application code talk to the database? Do the serialization and deserialization work as expected? If you write a message to a source message queue the service reads from, do you get the expected output on the target message queue the service writes to?

These kinds of tests work really well with containerized dependencies like those provided by [.NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/), [Testcontainers](https://testcontainers.com/), or [Docker Compose](https://docs.docker.com/compose/). This way you can spin up a "clean room" version of your service using ephemeral, containerized dependencies, so you catch all the tricky bugs that only happen when you actually try to talk to a real SQL database or deserialize objects from a real cache server, but without relying on specific records existing in a real database or leaving a bunch of crufty garbage data around in locations an actual running service is reading from.

I think a lot of people get tripped up by the word "integration" here, thinking it means the tests must talk to real external dependencies, using real credentials and real over-the-wire networking. But integration in this context is just referring to the integration of the services within a single system; where a unit test checks if a single drawer in your kitchen can open and close, an integration test checks that *all* the drawers open and close without obstructing each other, but it's still not testing your neighbor's kitchen or the ones in a house three states away.

{% include figure.html filename="testing-focal-length-meme.png" description="Notice the integration test would still only test the drawers in this one kitchen, not whether the electrical grid and sewer system are hooked up and the garbage pickup comes on Tuesdays. Those are acceptance or end-to-end tests." %}

Integration tests work well with [service-oriented-architecture](https://en.wikipedia.org/wiki/Service-oriented_architecture), or [domain-driven design](https://en.wikipedia.org/wiki/Domain-driven_design). If you've got an event-driven service that creates a record when an event happens and then emits another event to a downstream topic, you can simply test the *edges* of the system by emitting events and reading from the source and target message queues, without needing to care about the exact code paths that are being executed. This means tests are much less brittle and are testing the actual integration points of the system; if these break it means you're likely to break other real downstream consumers of your data.

But using ephemeral, containerized resources instead of real dependencies is still beneficial if you want to execute these tests in an automated way as part of a [continuous deployment](https://en.wikipedia.org/wiki/Continuous_deployment) strategy. You don't want to be blocked from putting out a hotfix when there's an outage because your integration tests are failing due to some unrelated issue with a service owned by another team or organization; you still want to fake anything you don't control and that isn't part of your subject-under-test; like the blurred-out background in a portrait photo.

## Acceptance Tests: The Telephoto Lens

{% include figure.html filename="testing-focal-length-telephoto.jpg" description="Acceptance tests check the whole workflow of a user-facing feature, including real dependencies." %}

Telephoto lenses in photography are good for looking at things from a distance. At this focal length, the subject-under-test is the whole *system*, including several services working together. If you're making a web application using service-oriented-architecture or domain-driven design, chances are the user performing an action in the interface actually depends on a whole host of back-end services working in concert.

For these sorts of tests that walk through an entire user-focused feature, scripting the activity to simulate a user of the application works well. [Selenium](https://en.wikipedia.org/wiki/Selenium_(software)) is a classic library which automates real browsers to click through a web application, but [Playwright](https://en.wikipedia.org/wiki/Playwright_(software)) is a more modern alternative with support for .NET, Node, Python, and Java.

At this point, you're likely pointing the tests at a real running application (albeit in a non-production environment). These tests tend to be somewhat brittle and inexact; if a Playwright test fails, you know there's a problem somewhere, but it may not be obvious exactly what has gone wrong, and you will likely need to go trawling through back-end logs to find the actual issue. Still, they are a good way to automate high-traffic user flows. These may be tests that you want to run on a scheduled basis or manually execute before a big release instead of including them in your continuous integration pipeline, since they tend to be slower and more prone to false positives.

## End-to-End Tests: The Wide-Angle Lens

{% include figure.html filename="testing-focal-length-wide.jpg" description="End-to-end tests are the furthest level of zoom. If something's broken in here, good luck figuring out where the issue actually is." %}

End-to-end tests are like using a wide-angle lens in photography, the subject-under-test is the entire ecosystem at once. All real resources, real dependencies. This is a bit like testing that all the systems of a house work together: HVAC, plumbing, weatherproofing, gas, electric, garbage pick-up, etc. 

These are also the slowest, most brittle tests, and hardest to diagnose when something goes wrong. A failing end-to-end test tells you *something* is broken, but doesn't tell you what. Many teams choose to run end-to-end tests manually rather than automating them, because the cost of maintaining them is so high, and they can lead to a kind of testing paralysis which saps a team of velocity as more and more time is spent updating brittle tests rather than implementing new features.

If you are going to automate end-to-end tests, it's generally better to have a small number of them for mission-critical paths rather than attempting to get 100% coverage.

## Keep the Subject in Frame

> The problem with object-oriented languages is they've got all this implicit environment that they carry around with them. You wanted a banana but what you got was a gorilla holding the banana and the entire jungle.
>
> — Joe Armstrong, creator of [Erlang](https://en.wikipedia.org/wiki/Erlang_(programming_language))

Armstrong was talking about object-oriented languages, but the same trap exists in testing. Every time you reach for a real credentials file, a real external API, or a real shared database when a controlled dependency would do, you've changed the subject-under-test to include the whole jungle.

Keeping the scope under control makes it much easier to tell whether something works and, when it doesn't, where the problem is. Teams quickly learn to ignore flaky tests that try to include too much of the world. Once that happens, the tests are worse than useless: they've trained everybody to assume a failure is harmless, including the one time a release really is broken.
