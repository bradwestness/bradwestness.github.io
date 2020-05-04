---
layout: post
title: Running Entity Framework Queries from Embedded Resource SQL Files
categories: [Programming,Software]
image: content/images/sql-resource.png
---

## Persistence, Neglected

I've been gnawing on this bone for a long time: data persistence is perhaps the most important part of essentially any non-trivial application, and yet it's the piece that seems to get the least tooling love in many programming ecosystems.

I'm not talking about DBA level tooling, which is pretty uniformly great across the major database platforms, I'm talking about the actual persistence layer of getting data into and out of the database from your application.

For front-end work, there's a seemingly never-ending onslaught of fancy tooling around scripting languages and templating. You got your LESS, your SASS, your TypeScript, your linters, your moustache frameworks, JSX, Vue components, etc.

For data persistence, there are a host of O/RMs in any given ecosystem. In the .NET world, the primary ones are [Entity Framework (by Microsoft)](https://docs.microsoft.com/en-us/aspnet/entity-framework) and [Dapper (by Stack Overflow)](https://github.com/StackExchange/Dapper). Both are great.

However, for advanced scenarios where you need to drop into some raw SQL, you wind up having a big string that doesn't have any syntax highlighting, intellisense, or any of the quaility-of-life things that developers have come to expect from modern tooling.

{% include figure.html filename="sql-string.png" description="Might as well be writing code in Notepad!" %}

I prefer to keep SQL in the application code versus using stored procedures for everything, because every stored procedure is a code smell. The existence of a stored procedure means you have business logic in your data layer, and every stored procedure is a production outage waiting to happen.

They aren't shipped with the app code and can therefore become out of sync with the app code, and as soon as one stored procedure doesn't return the right number of columns or adds a required paramter that the app doesn't send, things are going to go boom. Plus, the received wisdom that stored procedures are inherently faster than parameterized queries is a myth.

But, having all your most complicated persistence logic in a big dumb string is definitely sub-optimal.

## Enter the Embeds

I have always hoped someone would come up with a better way to handle this that was built into the IDE. In fact, [JetBrains' Rider IDE](https://www.jetbrains.com/rider/) does have support for "SQL Fragments" where you can get intellisense inside of SQL strings.

However, if you're not lucky enough to use Rider in your day job, you may still be in the market for a solution that works with plain ol' Visual Studio.

A solution to this that I finally spun up at work was to include database scripts as .SQL files in the project as embedded resources, which can then be read at runtime and used to execute queries against EF database contexts. This has been well-enough received by my team that I figured I'd make it available as an open-source NuGet package for anybody else who might be interested. I called it [EFQueryScript](https://github.com/bradwestness/EFQueryScript).

{% include figure.html filename="sql-resource.png" description="Now this is pod racing!" %}

The upshot is that you get nice intellisense and syntax highlighting in Visual Studio when editing the .SQL files this way, but you can still easily execute them just as you would an ad-hoc SQL query with Entity Framework using an inline string.

```csharp
// Simply define a "script selector" class with properties
// that resolve to the names of the embedded resource
// SQL scripts in your project
// Note: This class must be in the same assembly as the embedded resources
public class ArtistScripts
{
	public string GetTop10ArtistsByPlaylistCount =>
		"Scripts.GetTop10ArtistsByPlaylistCount.sql";
}

public class ArtistDTO
{
    public long ArtistId { get; set; }
    public string Name { get; set; }
    public long PlaylistCount { get; set; }
}

public IEnumerable<ArtistDTO> GetTop10ArtistsByPlaylistCount()
{
	using (var dbContext = new ChinookDbContext())
	{
		// Execute the query using your script selector definition

		return dbContext
			.QueryScript<ArtistDTO, ArtistScripts>(
                x => x.GetTop10ArtistsByPlaylistCount
            )
			.ToList();
	}
}
```

I went with the "script selector" concept so that you have a hard reference to your embedded resource scripts. This means it's easier to track where they're used than if you just sprinkled string literal .SQL filenames all over the place.

There are versions for both Entity Framework 6 and Entity Framework Core, if you're so inclined:

* [EFQueryScript](https://www.nuget.org/packages/EFQueryScript/) (Entity Framework 6)
* [EFQueryScript.Core](https://www.nuget.org/packages/EFQueryScript.Core/) (Entity Framework Core)