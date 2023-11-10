---
layout: post
title: The Load-Bearing Spreadsheet
categories: [Software,Programming,.NET]
image: content/images/load_bearing_brace.png
---

Daniel Holmes, a developer at [Bluesky](https://bsky.app) (my favorite of the emerging Twitter alternatives in the wake of the Musk-pocalypse) recently made [a post](https://bsky.app/profile/dholms.xyz/post/3k67i2ehemv2n) referencing the idea of a "load-bearing bug":

{% include figure.html filename="load_bearing_bug.png" description="Post from @dholms.xyz on Bluesky" %}

This made me think of a phenomenon I've witnessed many times over the course of my career, something I'd like to call a "load-bearing spreadsheet."

> Almost every enterprise software project begins with the words "so there's this spreadsheet..."

Some area of the business is using a Google Doc to coordinate data between multiple users/departments.

That system works fine when it's only one or two people who need to coordinate via the spreadsheet, but eventually the spreadsheet becomes a mission-critical part of the business, with many concurrent users.

At some point the business will want this data to integrate with some other system, and enforce some kind of business logic and data integrity into the process.

That's a load-bearing spreadsheet. Back when I was in higher-ed, sometimes it was a load-bearing Access database, though I haven't encountered one of those in a while.

I find that from the earliest days, the majority of my role has basically been taking these load-bearing spreadsheets, and turning them into full fledged software systems.

That's the job.
