---
layout: post
title: AngularJS and the Post Graceful Degradation Era  
categories: [Software, Programming]
---
  
The term "graceful degradation" refers to the idea of <a href="http://en.wikipedia.org/wiki/Graceful_degradation" target="_blank">fault tolerance</a>, that a system continues to function in the event that one or more of it's component parts fails. In web development, this concept is most commonly applied to the usage of JavaScript.

Generally, the conventional wisdom has been that any behavior which is enabled by JavaScript within a web application must also function in the event that the visitor doesn't have JavaScript support in their client, or in the case that they've disabled it.

For example, if you have some validation rules on a set of inputs for a form, like that a zip code must be a five-digit number, you should do that same validation on both the client and the server so that if the user doesn't have JavaScript enabled, their experience will be approximately the same as if they do have JavaScript, albeit with an additional submit/reload of the page versus just doing the validation dynamically.

Web development frameworks like <a href="http://www.asp.net/mvc" target="_blank">ASP.NET MVC</a> make this kind of thing painless, especially regarding validation rules. <a href="http://bradwilson.typepad.com/blog/2010/10/mvc3-unobtrusive-validation.html" target="_blank">ASP.NET Unobtrusive Validation</a> enables you to set attributes on your properties to specify what kinds of values are allowed. The framework then takes care of implementing both client-side and server-side validation, so your visitors with JavaScript enabled will get nice, in-place validation, and those without it will still get validation but with slightly less immediate feedback.

Recently, however, there has been a huge shift toward client-side frameworks, with <a href="https://angularjs.org/" target="_blank">AngularJS</a> being the most popular in a walk. To be sure, the framework enables a lot of really powerful functionality in a way that is easy to implement with very little code. One thing that tends to get glossed over, however, is that a <a href="http://en.wikipedia.org/wiki/Single-page_application" target="_blank">single page application</a> (or "SPA") written with a JavaScript framework like Angular is unusable by any clients without JavaScript enabled. It's not usable in a degraded fashion, it just plain won't work at all.

The question then, is: is this something we need to care about? Are we in the "post graceful degradation era"? As a public employee, ensuring that all my web applications comply with the Americans with Disabilities Act is of paramount importance (and it should be for private developers too). This means ensuring that your applications are usable by users with vision problems who use screen readers like JAWS. This has traditionally been the justification for requiring that no functionality <em>requires</em> JavaScript, despite the fact that you might use JavaScript for enhancements for users that have it.

However, JAWS, and other screen reader software packages have been able to interpret content that is dynamically generated with JavaScript for several years, so that may no longer be a limiting factor. Still, it is a decision that you as a developer should make consciously: are you OK with your application being unusable by those without JavaScript?

Many times, the decision is made unconsciously, the developer of a web site thinks he or she is using graceful degradation, but in reality there are pieces of functionality that are only available to users with JavaScript enabled. This is similar to many websites that boast of their responsive, mobile-friendly design despite the fact that the developer just slapped a responsive framework like <a href="http://getbootstrap.com/" target="_blank">Bootstrap</a> on the site and didn't actually try it on any mobile devices, and there may be many portions that don't re-size correctly or are nearly impossible to use on a mobile device.

It may be better to simply be upfront about not supporting users without JavaScript versus pretending you do when really you don't. But either way, it's something that you should be aware of, and put some thought into.