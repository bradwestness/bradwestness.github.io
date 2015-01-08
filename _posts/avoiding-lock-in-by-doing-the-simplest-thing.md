Title: Avoiding Lock In by Doing The Simplest Thing That Could Possibly Work  
Published: 2014-07-21 19:36:38Z

I've ventured out and played with various blogging platforms through the
years: [WordPress](http://wordpress.org/), [Tumblr](https://www.tumblr.com/), 
[Blogger](https://www.blogger.com/home) and [Posterious](http://www.posterous.com/) have all powered
my site at various points. Most recently it was [Ghost](https://ghost.org/). The main reason
I've never really been able to settle on one is that I have two essential
requirements that none of them fully meet:

1. I want to own the content, and run on my own domain
2. I don't want to spend a lot of time administering the site

Most of these platforms do one of these well and the other poorly.
Even with the ones that you can host on your own domain for free,
you often don't *really* own the content, because it's split up
across fifty different database tables and there's no built-in
way to export the data to a usable format.

My criteria for item 2 has become somewhat strict as well. I wanted 
to be able to update my site via the following process:

1. Create a new [Markdown](http://daringfireball.net/projects/markdown/) (*.md) file

Not being able to find anything that worked quite the way I wanted, I went ahead and built it.

### Whither Metadata

I needed a way to save a few choice bits of metadata in each of my posts*
without using any kind of back-end datastore. I wanted this data to be 
stored directly in the markdown files. First, I was toying with saving 
this stuff as Explorer shell extension info, but that seemed brittle 
and very tied to a set of libraries that only work on specific Windows 
versions.

###### * Essentially, the title and the publish date. Posts with no publish date are not shown.

Then, I toyed with the idea of using JSON files to store metadata about
the posts. The last blogging platform I had moved the site to was Ghost,
so I had all the content in a .json export file already. This seemed like
a decent compromise: each post would have a *.md file containing the content
of the post, plus an accompanying .json file with metadata like the title,
post date, author, etc.

This worked OK, but the editing experience wasn't very user friendly, since
creating a new post required creating two files, and remembering the exact
JSON structure to use for the various metadata parameters.

Then, I found an article about [MultiMarkdown](http://fletcherpenney.net/multimarkdown/). It's a superset of Markdown
that adds support for things like footnotes, tables, automatic cross-referencing,
and *document metadata*. Bingo!

I couldn't find any libraries or packages that supported MultiMetadata in the
ASP.NET ecosystem, so I created my own: [MetadataMarkdownSharp](http://www.nuget.org/packages/MetadataMarkdownSharp/). It's a wrapper
for [MarkdownSharp](https://code.google.com/p/markdownsharp/) which adds document metadata support based on the MultiMarkdown
standard. Note that it doesn't support all the other additional MultiMarkdown
features, just document metadata, which is why I didn't call it MultiMarkdownSharp.

### There Is No Database, and That's Okay

Anyway, my site is now backed by a simple set of flat files. There's no database.
There's no admin area. There's no WYSIWYG editor. There's no tags, categories, 
post types, widgets or plugins.

It'll never have critical security patches or obsucre shell commands or an install wizard
or an upgrade path that breaks compatibility with previous versions, either.

I think it's easy, as a software developer, to overengineer things anticipating
huge volumes of data and users. We forget that, most of the time, we're not building
Facebook. We're building little sites that will only ever have a half dozen concurrent users.
However, this site is only ever going to be a 
single-author blog. I use Disqus for comments and Google Analytics for tracking.

So why should I use a system that is way more complex than what I need? The number of
posts I would have to write before simply enumerating through a filesystem listing
becomes noticeably slow is several orders of magnitude larger
than the number I could realistically write in my lifetime.

Plus, my posts are now just text files that I can easily edit using any computer on
the planet, not spread across a dozen tables in some server out in "the cloud," and not even
portable database that will get corrupted if I transfer it using the wrong FTP mode, and
can only be accessed if the correct version of the correct drivers are installed.

There's a famous saying in the software engineering industry:

> Do the simplest thing that could possibly work.
> 
> -[Ward Cunningham](http://www.artima.com/intv/simplest.html)

Anyway, the site is actually [out on Github](https://github.com/bradwestness/bradwestness.com) if anyone is interested in forking it.
There's configurable settings for anything specific to the domain name or what have you.

It's pretty simple.