---
layout: post
title: Organizing Your Code to Minimize the 'Blast Radius'
categories: [Software,Programming]
image: content/images/character_classes.jpg
---

I was recently listening to an episode of the [.NET Rocks podcast with guest Steve "Ardalis" Smith](2024-04-07-organizing-your-code-for-minimal-blast-radius) and Steve articulated an issue I've tried to highlight in code reviews many times in the past in a very succinct way that I loved: you want to organize your code in such a way as to minimize the "blast radius" when you inevitably make a change.

{% mermaid %}
flowchart TD
    A[API Endpoint] --> |Depends on| B(User service)
{% endmermaid %}