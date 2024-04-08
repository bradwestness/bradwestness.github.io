---
layout: post
title: Organizing Your Code to Minimize the 'Blast Radius'
categories: [Software,Programming,.NET]
image: content/images/blast-radius.jpg
---

I was recently listening to an episode of the [.NET Rocks podcast with guest Steve "Ardalis" Smith](https://www.dotnetrocks.com/details/1888) and Steve articulated an issue I've tried to highlight in code reviews many times in the past in a very succinct way that I loved: you want to organize your code in such a way as to minimize the "blast radius" when you inevitably make a change.

Without prescribing any specific architecture, let's assume you've got some kind of onion layer or n-tier pattern going (when it comes to layers, I think [three is the magic number](https://brad.westness.cc/2014/10/13/peach-driven-development/), myself). 

### The Happy Path

For this post, we'll assume a basic eCommerce system with Users, Products, and Orders.

The naive, happy path might look something like this:

<pre class="mermaid">
flowchart TD
    A["HTTP API"] --> |Depends on| B(User service)
    B --> |Depends on| C(User repository)
    C --> |Depends on| D[(Users)]
</pre>

Now, in this very straightforward example, testing changes is pretty easy. If you change a component, you simply have to test everything above it. For example, if you make a change to the User service, you need to test both the user service and the API endpoint, but you shouldn't need to re-test the User repository or databsae table if they haven't changed at all.

This is what Steve Smith referred to as the "blast radius" in the podcast episode - what things are **possibly broken** by a given change? Basically, anything with an arrow pointing to the thing that changed is the blast radius.

If you have a true microservice architecture like the above diagram, this is pretty easy since there's really only one "path" in the flowchart, and everything lies on it. However, there's quite a bit of overhead to doing microservices to this degree, where every individual data element is completely segregated in it's own system. 

I think of this as more of a "picoservice," and if you're not Amazon or Netflix, you probably don't need to architect things to this degree of separation. Most organizations following Domain Driven Design land somewhere more like "mini services," which are not quite as tiny as true microservices.

What you might end up with is an architecture that looks a little something more like this:

<pre class="mermaid">
flowchart TD
    A["HTTP API"] --> |Depends on| B(User service)
    A --> |Depends on| C(Product service)
    A --> |Depends on| D(Order service)
    B --> |Depends on| E(User repository)
    C --> |Depends on| F(Product repository)
    D --> |Depends on| G(Order repository)
    E --> |Depends on| H[(Users)]
    F --> |Depends on| I[(Products)]
    G --> |Depends on| J[(Orders)]    
</pre>

Even though you've now got multiple "types of things" whithin one domain, you've still got a pretty clear demarcation of the blast radius of any given change. If you change the Product repository, you shouldn't have to re-test the User service, for example.

Or, if you determine that the Product service really should be spun off into it's own separate microservice (if it has different scaling needs, say) you can pull it out cleanly without having to worry about untangling it from too many other concerns.

### Let's Get Real

Now, this is still an overly-rosy view of a system architecture. In practice, what tends to happen is that the User service needs to pull some Order data in. And the Order service obviously needs to get the products on a given order. If you're using dependnecy injection and inversion-of-control pattnerns, it's all too easy to simply inject another repository instance into the User service. Which means there are now a few more lines of dependency to keep track of.

If you were to pull an accurate diagram of a system like this, it would probably look more like this:

<pre class="mermaid">
flowchart TD
    A["HTTP API"] --> |Depends on| B(User service)
    A --> |Depends on| C(Product service)
    A --> |Depends on| D(Order service)
    B --> |Depends on| E(User repository)
    B --> |Depends on| G
    C --> |Depends on| F(Product repository)    
    D --> |Depends on| G(Order repository)
    D --> |Depends on| F
    E --> |Depends on| H[(Users)]
    E --> |Depends on| J
    F --> |Depends on| I[(Products)]    
    G --> |Depends on| J[(Orders)]
    G --> |Depends on| I
</pre>

Now things have gotten a little knottier. If you add a feature to the order repository, it may not be obvious that it affects the User service, for example. The blast radius of each service has gotten large as more lines of communication were opened between them.

However, I still think in pragmatic terms this is mostly fine. The realities of creating useful API endpoints that it's often just not feasible to truly segregate everything in a perfectly pure way. Perfomance concerns have a way of dictating some compromises in this regard.

### Here There Be Dragons

As long as all the arrows are pointing down, it's still not **super** hard to trace the blast radius of any given change. It's a little like a Jenga tower, sure. But like Jenga, if you're touching a given block, you only have to worry about the ones above.

The insidious, dangerous, and subtle thing that can happen in practice is this: A developer will be adding a feature to the User service that has some cross-cutting implication. Say, to get a list of five "suggested products" based on the user's past orders. The developer will think "there's a useful method in the Product service that already encapsulates this functionality. To avoid duplication and to ensure consistent behavior, I'll just use call that existing method for this new feature."

Again, using inversion-of-control patterns, it's all too easy to simply inject the other service into the one that needs to use the shared functionality. Then you wind up with code like this:

```csharp
public class UserService(
    IUserRepository userRepository, 
    IOrderRepository orderRepository,
    IProductService productService) // <--- BAD!
{
  // ...
}
```

One of these things is not like the others! By injecting an `IProductService` instance into the `UserService` class, a dependency arrow has been introduced which does not go down to the layer below. Now there are services at the same layer of the app that depend on each other. Which can wind up looking like this:

<pre class="mermaid">
flowchart TD
    A["HTTP API"] --> |Depends on| B(User service)
    A --> |Depends on| C(Product service)    
    A --> |Depends on| D(Order service)
    B --> |Depends on| C
    B --> |Depends on| D
    B --> |Depends on| E(User repository)
    B --> |Depends on| G    
    C --> |Depends on| F(Product repository)    
    D --> |Depends on| G(Order repository)
    D --> |Depends on| B
    D --> |Depends on| F
    E --> |Depends on| G
    E --> |Depends on| H[(Users)]
    E --> |Depends on| J    
    F --> |Depends on| I[(Products)]    
    G --> |Depends on| J[(Orders)]
    G --> |Depends on| H    
    G --> |Depends on| I
</pre>

Now what we've got is a ball of mud. The dependency chain no longer flows "downhill" from one layer to the next (note how [Mermaid](https://mermaid.js.org/intro/getting-started.html) can no longer lay the layers out in neat rows). There's even a circular dependency between the User service and the Order service!

It becomes very hard to reason about the blast radius of any given change, because everything is connected to everything else.

### Only a Sith Speaks in Absolutes

I also really enjoyed the part of the .NET Rocks episode where Steve talks about how "it depends" is not a satisfactory answer to a question, despite the fact that it's one software engineers love to give. You have to follow "it depends" with what "it" depends "on," and what you'd do in each case.

So what should you do to prevent the situation above? I'm a pragmatist and I don't think having a hard-and-fast "never have one service reference a dependency it doesn't wholly own" rule is feasible to follow 100% of the time. But, there are a few guidelines I try to follow:

1. Dependencies should flow "downhill" from one layer to the next, and not "sideways" to another service at the same layer
2. If you need multiple services at the same layer to share some bit of functionality, extract that functionality out into a shared "utility" class or library, and have them both reference it, rather than directly referencing each other
3. Be cognizant of the "blast radius" of a given service or class, by tracking how many things depend on it. If it's become too hard to track what parts of the system will be affected by changing the class, it probably needs to be broken up into smaller components.
