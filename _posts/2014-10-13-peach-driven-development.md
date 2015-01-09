---
layout: post
title: Peach Driven Development
---
  
There's a virtually infinite number of ways to structure projects when working in an IDE like Visual Studio. Lately I've been thinking a lot about how I structure my solutions, and I'd like to establish a convention that I can use when beginning a new project that helps do the following:

1. Maintain separation of concerns between the various layers of the application (e.g. user interface, database, etc)
2. Does not introduce too much complexity (i.e. no more layers than absolutely necessary to achieve goal #1)
3. Favor convention over configuration (no configuration heavy dependency injection frameworks, just good baseline conventions)

Having read [Jeffrey Palermo's excellent blog series on what he calls Onion Architecture](http://jeffreypalermo.com/blog/the-onion-architecture-part-1/), I like the concepts he's discussing, but I felt like an onion is not the best metaphor, since they have a million layers (too much complexity), and all the layers are pretty much indistinguishable from each other. Telling someone to structure their application "like an onion" doesn't really give an immediate idea of where to start or what the finished project should look like.

I began to wonder what a better real-world example of the sort of layering that should be done might be, when I stumbled across this graphic on the [Wikipedia entry for Business Logic](http://en.wikipedia.org/wiki/Business_logic):

![http://en.wikipedia.org/wiki/File:Overview_of_a_three-tier_application_vectorVersion.svg]({{ site.baseurl }}content/images/business_logic.png)

I really like the idea of the "three tier" architecture, since it is a more concrete example than just saying "use multiple tiers" and gives you an idea of what belongs in each, and I like the way this diagram shows how each layer sits on top of the one below it, but can't immediately see what lies beyond the next layer boundary in either direction.

So what real-world example fits along with this pattern? You may have guessed from the article's title:

![peach and earth]({{ site.baseurl }}content/images/peach_earth.jpg)

I like the way that these examples map to a piece of software. The crust (or skin, or peel, or whatever) is the UI, visible to the outside world. The mantle (or 'inner peach,' a.k.a. the meat of the fruit) is the business logic layer, which is where the majority of your application's code belongs. The "outer core" or the peach pit, is the persistence layer. The earth diagram has an extra layer, the inner core, which corresponds to the "Storage" item in the Wikipedia diagram above. This is the actual disk-based storage the database uses, which your application doesn't really need to care about.

So now, whenever I start a new solution, I create the following three projects:

* __Data__ - contains the code for interacting the the persistence layer (whether this is Entity Framework classes, custom SQL stuff, JSON files on the filesystem, whatever)
* __Logic__ - contains all the business logic for actually implementing the requirements of the application (depends on the Data project).
* __Web__ - since most of my projects are ASP.NET MVC web apps, I've been naming my UI project "Web" rather than "UI". This leaves the door open for a possible additional UIs (a mobile client, console app, Windows Forms app, whatever. Depends on the Logic project).

I'm not 100% sold on the name "Logic" for the middle-tier, but I do like it better than other names that I've seen for this layer, like Domain or Model ("domain" is too meaningless, "model" is overused and winds up meaning a half-dozen different things depending on where you are in the app and can cause name collisions).

Obviously, there are other examples that work as well. This three-tier archetecture appears quite frequently in nature. In computer science, you're taught that anything other than 0, 1 and "n" are "magic numbers" and should never be hard-coded into a system. 

In this case, I think that three really is magic. In fact, I'm not alone.

<iframe width="420" height="315" src="//www.youtube.com/embed/aU4pyiB-kq0" frameborder="0" allowfullscreen></iframe>