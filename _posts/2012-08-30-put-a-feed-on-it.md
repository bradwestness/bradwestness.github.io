---
layout: post
title: Put a Feed On It  
---
  
> Did you see this bag before? I didn't. Now there's a bird on it. It's flying, it's free!
> 
> -Lisa Eversman, *"Put a Bird on It"*

![]({{ site.baseurl }}content/images/imgres.jpg)

If you're making a webapp that deals with public data, especially timestamped records that are for public display, here's a good rule of thumb to follow: <strong><em>put a feed on it</em></strong>. At some point, you're going to want to pull that data into another place and display it as part of some landing page or aggregate it into some 3rd party service.

If you work in a large enough organization, somebody's eventually going to want to pull in your data. If you've exposed a feed, you control the business logic of what gets shown. If you don't expose a feed, someone's eventually going to find a way to pull the data directly from your database, probably without your knowing anything about it, and who knows if they're respecting the intended design of your models, which they've probably had to reverse engineer by guess.

Luckily, it's incredibly easy to "put a feed on it." I recently did this with an <a href="http://www.asp.net/mvc" target="_blank">ASP.NET MVC</a> webapp that was in the latter situation described above.

### Create Serializable Feed Models

First, you'll want to create some models specifically for using as feed items. I created the following, which enabled me to map our <a href="https://announcements.uww.edu/" target="_blank">Announcement Board application's</a> data models into an <a href="http://en.wikipedia.org/wiki/RSS" target="_blank">RSS 2.0</a> compatible feed.

##### AnnouncementFeed.cs (Feed Object)

First we need an object that will allow us to inject some of the required RSS fields into our output. Note that, while some of the elements are essentially read-only, if you don't supply a <code lang="csharp">set { }</code> definition, the field will be omitted from the feed output.

Attributes allow us to control how elements are named in the feed output.

<pre><code class="language-csharp">using System;
using System.Linq;
using System.Xml.Serialization;

namespace Announcements.Web.Models.Feed
{
    [Serializable]
    [XmlRoot(ElementName = "rss")]
    public class AnnouncementFeed
    {
        [XmlAttribute("version")]
        public string version
        {
            get { return "2.0"; }
            set { }
        }

        public string title { get; set; }

        public string language
        {
            get { return "en-us"; }
            set { }
        }

        public string description
        {
            get { return announcements.Count() + " Current Announcements"; }
            set { }
        }

        public string copyright
        {
            get { return String.Format("All material copyright {0} MySite.com", DateTime.Now.Year); }
            set { }
        }

        public string webMaster
        {
            get { return "webmaster@mysite"; }
            set { }
        }

        public string link { get; set; }

        public string pubDate { get; set; }

        public string lastBuildDate { get; set; }

        [XmlArray("channel")]
        [XmlArrayItem("item")]
        public AnnouncementItem[] announcements { get; set; }
    }
}</code></pre>

##### AnnouncementItem.cs (Feed Item Object)

We also need an object to display the actual feed items.

<pre><code class="language-csharp">using System;
using System.Xml.Serialization;

namespace Announcements.Web.Models.Feed
{
    [XmlRoot("item")]
    [Serializable]
    public class AnnouncementItem
    {
        public string title { get; set; }

        public string description { get; set; }

        public string author { get; set; }

        public string link { get; set; }

        public string guid { get; set; }

        public string pubDate { get; set; }
    }
}</code></pre>

&nbsp;

### Use AutoMapper to set up a Feed Profile

<a href="http://automapper.codeplex.com/" target="_blank">AutoMapper</a> is a great tool for mapping one kind of object into another (here we're mapping our data objects, or POCOs, into our RSS-compatible feed item objects), it will save you a lot of headaches if you ever change one of names of your fields (perish the thought) and keep your controllers clean.

Plus, we can do a little bit of formatting on things like the dates and author e-mails right here. Later, in the controller, we'll call <code lang="csharp">Mapper.Map&lt;&gt;</code>, which will translate the objects from one type to the other, using the rules we set up here.

<pre><code class="language-csharp">using AutoMapper;
using Announcements.Core.Data.Entities;
using Announcements.Web.Helpers;
using Announcements.Web.Models.Feed;

namespace Announcements.Web.Bootstrap
{
    public class FeedModelProfile : Profile
    {
        public override string ProfileName
        {
            get { return "FeedModel"; }
        }

        protected override void Configure()
        {
            CreateMap()
                .ForMember(d =&gt; d.title, x =&gt; x.MapFrom(s =&gt; s.Title))
                .ForMember(d =&gt; d.author,
                           x =&gt;
                           x.MapFrom(
                               s =&gt;
                               string.Format("{0} ({1})",
                                             s.ContactId.Contains("@") ? s.ContactId : s.ContactId + "@mysite.com",
                                             s.Contact)))
                .ForMember(d =&gt; d.description,
                           x =&gt; x.MapFrom(s =&gt; PageHelpers.Description(s.Description.ShortDescription)))
                .ForMember(d =&gt; d.pubDate, x =&gt; x.MapFrom(s =&gt; s.SubmitDate.ToString("r")))
                .ForMember(d =&gt; d.guid, x =&gt; x.MapFrom(s =&gt; s.Id.ToString()))
                .ForMember(d =&gt; d.link, x =&gt; x.MapFrom(s =&gt; PathHelpers.AnnouncementDetails(s.Id)));
        }
    }
}</code></pre>

The <code class="language-csharp">PathHelpers.AnnouncementDetails(int id)</code> method is a static helper method that returns an absolute URL to the details of the given announcement. I also created a <code class="language-csharp">HomeDetails</code> helper method which I'll use when constructing the <code  class="language-csharp">AnnouncementFeed</code> object for display.

<pre><code class="language-csharp">using System;
using System.Web;
using System.Web.Mvc;

namespace Announcements.Web.Helpers
{
    public static class PathHelpers
    {
        public static string HomeIndex()
        {
            var helper = new UrlHelper(HttpContext.Current.Request.RequestContext);
            string scheme = HttpContext.Current.Request.Url.Scheme;

            return new Uri(
                helper.RouteUrl("Default",
                                new
                                    {
                                        controller = "Home",
                                        action = "Index"
                                    },
                                scheme
                    )).GetComponents(UriComponents.Scheme | UriComponents.Host | UriComponents.PathAndQuery,
                                     UriFormat.UriEscaped);
        }

        public static string AnnouncementDetails(int announcementId)
        {
            var helper = new UrlHelper(HttpContext.Current.Request.RequestContext);
            string scheme = HttpContext.Current.Request.Url.Scheme;

            return new Uri(
                helper.RouteUrl("Default",
                                new
                                    {
                                        controller = "Announcement",
                                        action = "Details",
                                        id = announcementId
                                    },
                                scheme
                    )).GetComponents(UriComponents.Scheme | UriComponents.Host | UriComponents.PathAndQuery,
                                     UriFormat.UriEscaped);
        }
    }
}</code></pre>

### Create a Controller To Generate the Feed

I created a controller named <code class="language-csharp">FeedController</code>, because I wanted the feed to show up at www.myapp.com/feed. I also created a "Json" method (using <a href="http://mvccontrib.codeplex.com/" target="_blank">MvcContrib's</a> <code lang="csharp">XmlResult</code> and <code lang="csharp">JsonResult</code> <code lang="csharp">ActionResult</code> types), so that one would be available at www.myapp.com/feed/json.

I also used an object cache to cache the results so that the feed would only have to be regenerated once per half-hour, to save on database requests.

<pre><code class="language-csharp">using System;
using System.Collections.Generic;
using System.Runtime.Caching;
using System.Web.Mvc;
using AutoMapper;
using MvcContrib.ActionResults;
using Announcements.Core;
using Announcements.Core.Data;
using Announcements.Core.Data.Entities;
using Announcements.Web.Helpers;
using Announcements.Web.Models.Feed;

namespace Announcements.Web.Controllers
{
    public class FeedController : Controller
    {
        #region Declarations

        private static readonly ObjectCache _cache = MemoryCache.Default;
        private readonly IAnnouncementRepository _announcements;
        private readonly IMappingEngine _mapper;

        public FeedController(
            IAnnouncementRepository announcementRepository,
            IMappingEngine mappingEngine
            )
        {
            _announcements = announcementRepository;
            _mapper = mappingEngine;
        }

        #endregion

        //
        // GET: /Feed/
        public ActionResult Index()
        {
            var result = _cache["feed"] as XmlResult;

            if (result == null)
            {
                AnnouncementItem[] announcements =
                    _mapper.Map&lt;IList&lt;Announcement&gt;, AnnouncementItem[]&gt;(_announcements.GetCurrent());

                var model = new AnnouncementFeed
                                {
                                    title = "University of Wisconsin-Whitewater - Announcements",
                                    description = String.Format("{0} Current Announcements", announcements.Length),
                                    link = PathHelpers.HomeIndex(),
                                    lastBuildDate = DateTime.Now.ToString("r"),
                                    pubDate = DateTime.Now.ToString("r"),
                                    announcements = announcements
                                };

                result = new XmlResult(model);
                var policy = new CacheItemPolicy
                                 {AbsoluteExpiration = DateTimeOffset.Now.AddMinutes(ApplicationSettings.CacheMinutes)};

                _cache.Set("feed", result, policy);
            }

            return result;
        }

        //
        // GET: /Feed/Json/
        public ActionResult Json()
        {
            var result = _cache["json"] as JsonResult;

            if (result == null)
            {
                AnnouncementItem[] announcements =
                    _mapper.Map&lt;IList&lt;Announcement&gt;, AnnouncementItem[]&gt;(_announcements.GetCurrent());

                var model = new AnnouncementFeed
                {
                    title = "University of Wisconsin-Whitewater - Announcements",
                    description = String.Format("{0} Current Announcements", announcements.Length),
                    link = PathHelpers.HomeIndex(),
                    lastBuildDate = DateTime.Now.ToString("r"),
                    pubDate = DateTime.Now.ToString("r"),
                    announcements = announcements
                };

                result = new JsonResult{ Data = model, JsonRequestBehavior = JsonRequestBehavior.AllowGet};
                var policy = new CacheItemPolicy { AbsoluteExpiration = DateTimeOffset.Now.AddMinutes(ApplicationSettings.CacheMinutes) };

                _cache.Set("json", result, policy);
            }

            return result;

        }
    }
}</code></pre>

### Enable Cross-Domain Requests (If You Want)

You also might want to go into your <code class="language-xml">Web.Config</code> and enable cross-domain requests to your feeds, so people can access them from anywhere (if they're truly public, that is):

<pre><code class="language-xml">&lt;system.webServer&gt;
 &lt;httpProtocol&gt;
  &lt;customHeaders&gt;
   &lt;add name="Access-Control-Allow-Origin" value="*" /&gt;
  &lt;/customHeaders&gt;
 &lt;/httpProtocol&gt;
&lt;/system.webServer&gt;
</code></pre>

*Note: The "X-UA-Compatible" header I'm setting above just forces Internet Explorer to use it's most up-to-date rendering engine when viewing the website. It won't affect the feeds at all, but it's handy if IE decides to render your site in IE7 mode for whatever reason, so I'm leaving it in.*

### That's it!

Now you've got a canonical feed for people to use in order to pull your data into other places, where you control the data that gets displayed, and the formatting of everything in the feed.

> Did you see this data before? I didn't. Now there's a feed on it. It's flying, it's free!
> 
> -Brad Westness (me)

### Now Watch the Sketch

Just for good measure, here's the original "Put a Bird On It" sketch from <a href="http://www.ifc.com/shows/portlandia" target="_blank">Portlandia on IFC</a> in case you haven't seen it:

<iframe width="560" height="315" src="//www.youtube.com/embed/0XM3vWJmpfo" frameborder="0" allowfullscreen></iframe>
