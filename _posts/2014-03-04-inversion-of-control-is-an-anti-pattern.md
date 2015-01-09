---
layout: post
title: Inversion of Control is an Anti-Pattern  
---
  
I'm calling you out, <a href="http://docs.structuremap.net/" target="_blank">StructureMap</a>. And you too, <a href="http://www.ninject.org/" target="_blank">Ninject</a>. Here's the thing: Inversion of Control (or Dependency Injection if you're nasty) is a powerful tool that can be used to great effect in large projects to keep the various pieces of the project loosely coupled. However, it is very easy to get subtly wrong in a way that is harmful to the testability of your application and causes you to spend more time mucking with IoC configuration* than whatever is saved in future maintainability.

###### * The syntax of which <strong><em>will </em></strong>change with each release and break your app when you update your NuGet packages.

For example, assume you're writing an <a href="http://www.asp.net/mvc" target="_blank">ASP.NET MVC</a> web application. Let's say you are using a <a href="http://msdn.microsoft.com/en-us/library/ff649690.aspx" target="_blank">repository pattern</a> for your persistent data, and you need to interact with several different repositories within a given Controller:

<pre><code class="language-csharp">public OrderController(
    IOrderRepository orderRepository,
    IUserRepository userRepository,
    IProductRepository productRepository,
    ...
)</code></pre>

I've worked on apps that have dozens of parameters passed in this way, all initialized automagically by StructureMap. The repository objects themselves may depend on the existence of several other objects for their constructors (a <a href="http://entityframework.codeplex.com/" target="_blank">DbContext</a>, <a href="http://nhforge.org/" target="_blank">SessionFactory</a> or similar). While this works fine whenever your IoC container handles the creation of all the nested sub-types, you can no longer write a useful automated unit test without stubbing out three or four layers of objects that are handled by your IoC container, and if you've got private types with no setters, it can be essentially impossible.

In my experience, the amount of time spent implementing and configuring an IoC container usually does not pay for itself, since you wind up having to make changes all over your app if you try to swap out the interface implementation, even though you should theoretically be able to simply make changes to the IoC configuration. While not using an IoC pattern may not address the prospect of swapping out portions of your application in the future, at least you are not assuming various dependencies are swappable when they are really not.

Are you really going to ever swap out the persistence mechanism of your line-of-business app? Probably not. And if you do, I can virtually guarantee that it will require more changes than simply swapping out the IoC configuration. If you're going to use IoC, understand specifically why you need it, and what the costs are, relative to the benefits. <a href="http://en.wikipedia.org/wiki/Cargo_cult_programming" target="_blank">Don't assume you should use it just because it's cool.</a>

The root of why I think IoC is an <a href="http://en.wikipedia.org/wiki/Anti-pattern" target="_blank">anti-pattern</a> is that it lulls the developer into thinking their solutions are future-proof and dependency-agnostic, when really they most likely aren't. Better to be upfront about your application's dependencies than to be uninformed.