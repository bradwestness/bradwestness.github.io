---
layout: post
title: WebAPI Test-O-Matic
---

While investigating migrating the API code in our application at work from the nearly-abandoned [Jayrock RPC](https://code.google.com/archive/p/jayrock/) framework to the more widespread and well-supported [ASP.NET WebAPI](https://www.asp.net/web-api), I noticed that there was one nice-to-have that Jayrock enjoyed over WebAPI -- it has a built-in automated tester which enables you to compose and submit AJAX requests to your API endpoints.

Well, I thought, certainly such a thing should be possible for WebAPI as well. Enter WebAPI Test-O-Matic! I found that there are is a super-convenient [ApiExporer](https://msdn.microsoft.com/en-us/library/system.web.http.description.apiexplorer(v=vs.118).aspx) class included in the box with WebAPI. This is what WebAPI uses to generate it's built-in "[help pages](https://docs.microsoft.com/en-us/aspnet/web-api/overview/getting-started-with-aspnet-web-api/creating-api-help-pages)." This made it really easy to sniff-out and generate testing for all the configured WebAPI endpoints in a given ASP.NET application.

To use WebAPI Test-O-Matic, all you have to do is register the HTTP Handler in your ASP.NET application, like this:
```xml
  <system.webServer>
    <handlers>
      <remove name="WebApiTestOMatic" />
      <add name="WebApiTestOMatic" path="apitest.ashx" verb="*" type="WebApiTestOMatic.Handler, WebApiTestOMatic" />
      <remove name="ExtensionlessUrlHandler-Integrated-4.0" />
      <remove name="OPTIONSVerbHandler" />
      <remove name="TRACEVerbHandler" />
      <add name="ExtensionlessUrlHandler-Integrated-4.0" path="*." verb="*" type="System.Web.Handlers.TransferRequestHandler" preCondition="integratedMode,runtimeVersionv4.0" />
    </handlers>
    <validation validateIntegratedModeConfiguration="false" />
  </system.webServer>
```

Also make sure that MVC/WebAPI are configured to ignore the route to WebAPI Test-O-Matic:
```csharp
public static void RegisterRoutes(RouteCollection routes)
{
    routes.IgnoreRoute("{resource}.axd/{*pathInfo}");
    routes.IgnoreRoute("{resource}.ashx/{*pathInfo}");

    routes.MapRoute(
        name: "Default",
        url: "{controller}/{action}/{id}",
        defaults: new { controller = "Home", action = "Index", id = UrlParameter.Optional }
    );
}
```

That's it! You should now be able to hit the URL configured in your web.config for the HTTP Handler above. This will give you a nice UI for testing your WebAPI controllers and actions:

[![WebAPI Test-O-Matic screenshot](https://raw.githubusercontent.com/bradwestness/WebApiTestOMatic/master/assets/screenshot.png "WebAPI Test-O-Matic Screenshot")](https://raw.githubusercontent.com/bradwestness/WebApiTestOMatic/master/assets/screenshot.png)

The HTTP handler is entirely self-contained, so you don't need to include any other files in your project other than the DLL. It does include client-side references to [Bootstrap](http://getbootstrap.com/) and [jQuery](http://jquery.com/) from the [Microsoft Ajax Content Delivery Network](https://docs.microsoft.com/en-us/aspnet/ajax/cdn/overview), which keeps the DLL really small as I don't have to bundle those in.

You can view and contribute to the project on [GitHub](https://github.com/bradwestness/WebApiTestOMatic), or install it using [NuGet](https://www.nuget.org/packages/WebApiTestOMatic/).

Let me know what you think!