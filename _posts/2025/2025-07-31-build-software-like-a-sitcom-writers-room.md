---
layout: post
title: Build Software Like a Sitcom Writers Room
categories: [Software, TV, Personal]
image: content/images/30-rock-writers-table.jpg
---

In 2007, the [Writers Guild of America went on strike](https://en.wikipedia.org/wiki/2007%E2%80%9308_Writers_Guild_of_America_strike) for 99 days, from November 5, 2007 to February 12th, 2008. The strike had the effect of interrupting the production of TV series midway through their seasons. The writers were on strike over their lack of residuals from DVD sales, but actors and crews (being represented by separate unions) were not. Many shows were required by contract to continue filming any already-scripted episodes, but without input from the striking writers. 

> One of my favorite artifacts of this era was the recurring bit on _Late Night_ where Conan O'Brien would kill time that would've otherwise been devoted to written sketches by seeing how long he could spin his wedding ring on his desk:

<div class="embed-responsive embed-responsive-16by9"><iframe width="560" height="315" src="https://www.youtube.com/embed/9fpYpmksscA?si=KNXZsgqGf-TlWMW5" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>

## _30 Rock_ and the 2007 Writers Strike

_30 Rock_, then in its second season, was one such show. The production was compelled to continue filming until they ran out of scripted episodes, ultimately resulting in a shortened season where only 15 of the planned 22 episodes were completed. However, even these episodes were filmed without the ability to rewrite or punch up scenes as showrunner Tina Fey and the rest of the writers had done on the first season and at Saturday Night Live.

TV shows often have a single writer script the initial draft of each episode from a series of plot-point notecards using simple dialogue and placeholder gags that they know will be swapped out later during the rewriting and editing process. Legendary _Simpsons_ writer [John Swartzwelder](https://en.wikipedia.org/wiki/John_Swartzwelder) has a famous quote about this approach:

> I have a trick that makes things easier for me. Since writing is very hard and rewriting is comparatively easy and rather fun, I always write my scripts all the way through as fast as I can, the first day, if possible, putting in crap jokes and pattern dialogue—“Homer, I don’t want you to do that.” “Then I won’t do it.” Then the next day, when I get up, the script’s been written. It’s lousy, but it’s a script. The hard part is done. It’s like a crappy little elf has snuck into my office and badly done all my work for me, and then left with a tip of his crappy hat. All I have to do from that point on is fix it. So I’ve taken a very hard job, writing, and turned it into an easy one, rewriting, overnight. I advise all writers to do their scripts and other writing this way. And be sure to send me a small royalty every time you do it.\
> &mdash; <cite>[John Swartzwelder (2021) in The New Yorker][1]</cite>

## Designing Like a Writers Room 

This is the approach I like to take when designing software or "breaking" a new feature with a team. I find it useful to create a collaborative artifact like a Google Doc or LucidChart diagram and fill in a "crappy" broad strokes outline, like Swartzwelder recommends. Then, the fun part is getting your team around a table (or screen share) to pitch better ideas that will "beat" the crappy version in your initial draft. You can even intentionally include wrong or bad ideas in this draft to ensure that people will call them out and suggest something better. This way, the onus isn't on a single person to create a perfect solution to a complex problem in a silo.

Starting with an obviously unfinished artifact prompts better collaboration than either a blank page or something that looks complete. With a rough draft (or, for visual design, a wireframe) you don't have to worry so much about "killing your darlings" as you would with people pointing out flaws in a fussed-over "finished" plan. If you spend too long on the first draft before bringing it to your team, you risk becoming overly precious about your own ideas and wind up defending them because you're attached to them, instead of taking on feedback or better ideas. If the artifact appears to be "finished" before you present it, people may also be reticent to provide feedback that significantly alters the proposal, as it may seem to be too late in the process to change course.

There is a reason TV writers do have someone actually write that first draft, even though much of it will ultimately be replaced. If you prevent people with a complete blank slate, they're likely to just stare at it in silence, suffering from analysis paralysis. It often works much better to have a single person provide a starting point to provoke discussion rather than expecting a group to whiteboard something up from first principles.

Listening to the DVD commentaries of the second season of _30 Rock_ is a fascinating time capsule, and gives an illuminating window into Fey's approach to creating the series, famous for it's incredibly dense joke-a-second pace. She repeatedly bemoans gags or plot lines that she thinks they "could've beaten" at the table, meaning that someone would've pitched a joke that got a bigger laugh than the one in the credited writer's first draft. I try to bring this attitude to collaborative design sessions (whether functional or graphical), I _want_ you to beat my idea. I'd love nothing more than for you to suggest an alternative that would sidestep an issue I didn't anticipate. 

## "Yes, and" versus "No, but"

However, you do have to be wary of team members who consistently shut down proposals without suggesting alternatives. I think of this like a group of friends who are attempting to agree on a place to get lunch: you can't veto every idea without providing some of your own.

> A breakdown of _30 Rock_'s three-second masterclass on how __not__ to collaborate:

<div class="embed-responsive embed-responsive-16by9"><iframe width="560" height="315" src="https://www.youtube.com/embed/Kb_AHBGF5i8?si=RqqY1M-5ACXRwzsl" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>

It's not practical to have a zero-tolerance policy to shooting down an idea without suggesting an alternative, since there may in fact be a good reason _not_ to do something without a clear alternative of what to do instead. But I find it becomes clear in fairly short order when this is a pattern of behavior, at which point the best response may be to say "I understand your objection but until I hear a better option, we are going to move forward with the current proposal."

Like those _30 Rock_ episodes that got filmed without rewrites, sometimes you have no choice but to proceed with the crappy first draft. The good news is that, while a TV show can't exactly go back and punch up old episodes after the fact, in software you can always pivot and refactor when a better idea comes along.

[1]: https://www.newyorker.com/culture/the-new-yorker-interview/john-swartzwelder-sage-of-the-simpsons
