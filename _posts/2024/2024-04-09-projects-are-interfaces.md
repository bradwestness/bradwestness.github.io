---
layout: post
title: Internal is your friend. Projects are interfaces. Oceans are battlefields.
categories: [Software, Programming, .NET]
image: content/images/master_and_commander_header.jpg
---

In addition to the [great info about limiting the "blast radius" of your code](/2024/04/07/organizing-your-code-to-minimize-the-blast-radius/), there was a segment in [Steve Smith's recent appearance on the .NET Rocks podcast](https://www.dotnetrocks.com/details/1888) where he discussed a pattern I really like when it comes to structuring .NET code: heavily using the `internal` keyword.

## Projects are Interfaces

{% include figure.html filename="master_and_commander.jpg" description="Opening crawl of Peter Weir's MASTER AND COMMANDER: THE FAR SIDE OF THE WORLD (2003)" %}

When organizing a .NET solution, it's useful to [break apart the various layers of your application into separate projects](/2014/10/13/peach-driven-development/). This helps separate the concerns of your system, and also helps manage the dependency graph of packages each project needs to reference. This way, for example, your presentation layer doesn't need to directly reference the database driver that the data project uses.

What may be less obvious is that the _projects within an application themselves_ represent an interface that the project is exposing to the rest of the application. In the same way that you might choose not to expose some methods on a class in order to prevent calling code from taking a direct dependency on implementation details, you should be judicious about choosing whether to expose the classes and types within a given project to the rest of the solution.

For instance, let's say you have an incredibly simple and contrived example of an ASP.NET web application solution:

{% include figure.html filename="master_and_commander_screenshot_1.png" description="An incredibly simple and contrived example of an ASP.NET web application solution" %}

Now, it's pretty obvious that the **Data** project here is purposefully exposing the `IUserRepository` interface, and the **Domain** project is likewise exposing the `IUserService` interface. Why else would they have bothered to create the interfaces? Those are the contracts the projects are choosing to expose to the layers above them within the solution.

However, there's some extra stuff in those projects that are currently exposed as well. The **Data** project is exposing the `SampleDbContext` type, which is an implementation concern (the fact that the data project is using Entity Framework should be of no concern to the layers above), and the **Domain** project is exposing the `DataModelExtensions` class.

It's easy to inadvertently expose more than you intend to the rest of the application if you're in the habit of just rotely typing `public class MyClass` whenever you create a new `*.cs` file within your solution.

I think some engineers get in the habit of thinking that making as much of your code public (and not sealed) as possible allows more "flexibility" for users of those types. Which I think ***can*** generally be true for library code. [Several](https://www.nuget.org/packages/Microsoft.Azure.Cosmos) of [Microsoft's](https://www.nuget.org/packages/Azure.Messaging.ServiceBus) own [SDK libraries](https://www.nuget.org/packages/Azure.Search.Documents) have a bad habit of making all the types that users of the library need to interact with `abstract` with no public constructors, while all the concrete implementations are `internal` and `sealed` with no public constructors. Which results in the need for [wrapper libraries](https://www.nuget.org/packages/Cosmos.Factories) that need to implement a whole universe of [fake types](https://en.wikipedia.org/wiki/Mock_object) to make them testable, for instance. Ahem.

However, _a project within an application solution_ is a little different. You generally want a little tighter control over what types are exposed, because you want to retain the ability to change implementations later without having that change require a lot of corresponding work across all the other layers of the solution.

In the **Data** project of the sample solution above, the `SampleDbContext` and `UserRepository` classes can be defined with the `internal` keyword, meaning the other projects in the solution that reference the **Data** project no longer have any visibility into those types.

{% include figure.html filename="master_and_commander_screenshot_2.png" description="Note how the `UserRepository` class being marked as `internal` means that the `UserService` class can now only see the `IUserRepository` interface in its intellisense, ensuring the caller doesn't take a direct dependency on the concrete type." %}

## Give a Hoot, Don't Pollute

One feature of C# that is both extremely useful and very easy to abuse is [extension methods](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/extension-methods). Extension methods are great for adding some behavior to a given type without actually needing to modify that type. They're great for "mapping" type code.

From the Microsoft Learn page linked above:

> **Layer-Specific Functionality**
>
> When using an Onion Architecture or other layered application design, it's common to have a set of Domain Entities or Data Transfer Objects that can be used to communicate across application boundaries. These objects generally contain no functionality, or only minimal functionality that applies to all layers of the application. Extension methods can be used to add functionality that is specific to each application layer without loading the object down with methods not needed or wanted in other layers.

Let's look at the contents of the `DataModelExtensions` class in the **Domain** project of the sample application we're working with:

```csharp
using SampleApp.Data.Models;
using SampleApp.Domain.Models;

namespace SampleApp.Domain;

public static class Extensions
{
  public static UserDomainModel ToDomainModel(this UserDataModel dataModel)
  {
    ArgumentNullException.ThrowIfNull(dataModel);

    return new UserDomainModel
    {
      Id = dataModel.Id,
      FirstName = dataModel.FirstName,
      LastName = dataModel.LastName,
    };
  }
}
```

Here, the `UserDataModel` type is being mapped to the `UserDomainModel` type, because `UserDataModel` may have additional properties that we don't want to expose at the domain layer for security purposes (e.g. `PasswordHash` and `EmailAddress`).

> I like extension methods for this kind of mapping code, because they are much easier to reason about than something like [AutoMapper](https://docs.automapper.org/en/stable/), which is an excellent and very powerful [foot-gun](https://en.wiktionary.org/wiki/footgun). Whoever inherits this code base will thank you for writing an obvious (and easy to test) extension method rather than some surprising and "magic" mapping code.

The nice thing about using an extension method for this kind of thing is that it means the acutal `UserDomainModel` class doesn't need to know anything about the `UserDataModel` class. Extension methods are great for these sort of boundary-crossing parts of code where you don't want one layer to know too much about the internals of another.

However, there is one common misconception about extension methods. Note the last line of the above Microsoft Learn quote (emphasis mine):

> Extension methods can be used to add functionality that is specific to each application layer _without loading the object down with methods not needed or wanted in other layers_.

Extension methods have to be `static` by definition. The misconception is that people seem to think they also need to be `public`. They don't! You can define `internal` extension methods, or even `private` ones! The containing class just has to be `static`.

I like using `private static` or `internal static` wherever possible, because it guarantees the method is [stateless](https://en.wikipedia.org/wiki/Stateless_protocol) (unless you store state in a static field, which... don't do that).

C# is an object-oriented language, but the .NET team has added a lot of [functional language](https://en.wikipedia.org/wiki/Functional_programming) features in recent releases. I like to think of writing `private static` methods in C# as sort of a poor-man's functional programming.

You can reason about a method like this much easier because you can clearly trace the inputs and outputs and don't have to think about how statefulness might impact the result of a given method.

{% include figure.html filename="master_and_commander_screenshot_3.gif" description="When a namespace has become polluted with lots of extenion methods, it becomes difficult to find the actual method you want to call." %}

Making the methods `private` or `internal` also has the benefit of not _polluting_ the namespaces of the types you actually want to expose to other projects in the solution. If you've ever worked on an application that references a lot of extenion method libraries, you'll notice that it becomes hard to find the actual method you want to call when "dotting into" a particular object with Intellisense, because there are a hundred extension methods that are all broadly applicable to type `Object`, and that is sort of the opposite of a pit of success. You want it to be obvious to callers which methods they should use to do the thing they want to do with your type.

## Whither Tests

If you're liberally using `private` and `internal`, that doesn't mean you can't test those methods. You can use the `InternalsVisibleTo` directive in the project file to expose `internal` types to your tests project only, while keeping them hidden from the other projects within your solution.

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\SampleApp.Data\SampleApp.Data.csproj" />
  </ItemGroup>

  <ItemGroup>
    <InternalsVisibleTo Include="SampleApp.Tests"/>
  </ItemGroup>

</Project>
```

{% include figure.html filename="master_and_commander_screenshot_4.png" description="With the `InternalsVisibleTo` option exposing the internal types only to the tests project, I can still write unit tests against my extension methods without exposing them outside of their containing project." %}

## Charting Your Course

So just remember:

- Internal is your friend. Make any type that you don't specifically wish to expose outside of a given project `internal` by default.
- Projects are interfaces. Only expose things to the rest of the solution that you want other projects to take direct dependencies on. If you expose it, someone **will** take a direct dependency on it.
- Oceans are now battlefields.

Happy sailing!
