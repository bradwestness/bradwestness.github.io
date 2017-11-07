---
layout: post
title: The Pit of Poor Performance - Part 1
---

This is a story about some code I recently refactored at work, which resulted in a process that previously took double-digit numbers of hours down to about 20 minutes. I think it's an interesting case because it was such a dramatic performance increase, and the root cause for the performance problem was something I think software developers run into a lot.

## The Problem

For the sake of this post, I'll try to keep things as generic as possible. The essence of the problem that we were trying to solve was resolving links between two publications, which happen to be XML-based documents which contain schemata for airplane engines. 

As you can imagine, these manuals are *huge* (like, they have hundreds of thousands of *chapters*). The links between them use a custom scheme by which the link element (think of it as an `<a>` tag in HTML) contains a bunch of attributes which describe the target publication and section to which the link is supposed to point.

Let's say the link looks something like this:

```xml
<refext docnbr="FOO 1-82-2" refloc="FOO34-21-09-400-801" refman="FOO" refmodel="BAR">FOO TASK 21-25-09-400-801</refext>
```

Here, "FOO" is the name of the publication being referenced, "BAR" is the model of the aircraft this publication applies to, "docnbr" is (you guessed it) a document number, and "refloc" is a special notation which corresponds to a specific location within the publication.

So what we wind up with is a bunch of attributes which relate to the publication itself:

| Attribute | Value |
| --------- | ----- |
| DOCNBR | FOO 1-82-2 |
| MAN | FOO |
| MODEL | BAR |

Somewhere within our system is a document which contains these attributes as records in a `PublicationAttribute` SQL table.

The REFLOC value is special and refers to the "section" that is to be referenced (basically, the chapter), and breaks down like this:

| Attribute | Value |
| --------- | ----- |
| MAN | FOO |
| CHAPNBR | 34 |
| SECTNBR | 21 |
| FUNC | 09 |
| SEQ | 400 | 
| PGBLKNBR | 801 |

Somewhere in the system, there is a section which contains these attributes as records in a `PublicationSectionAttribute` SQL table.

## The Solution (first draft)

So, let's write some pseudocode to resolve these references:

```csharp
// loop through the sections to get refext nodes
foreach (var section in publication.Sections) 
{    
    // loop through the refext nodes to resolve references
    foreach (var referenceNode in publication.Sections.SelectNodes("//refext")) 
    {
        var publicationAttributes = new Dictionary<string, string>();
        var sectionAttributes = new Dictionary<string, string>();

        foreach (var attribute in referenceNode.Attributes) 
        {
            switch (attribute.Name)
            {
                case "REFLOC"
                    var tokens = attribute.Value.Split('-');
                    // we don't care about tokens[0] because
                    // it's redundant
                    sectionAttributes.Add("CHAPNBR", tokens[1]);
                    sectionAttributes.Add("SECTNBR", tokens[2]);
                    sectionAttributes.Add("FUNC", tokens[3]);
                    sectionAttributes.Add("SEQ", tokens[4]);
                    sectionAttributes.Add("PGBLKNBR", tokens[5]);
                    break;

                default:
                    publicationAttributes.Add(attribute.Name, attribute.Value);
                    break;
            }
        }

        var targetPublicationId = publicationRepository.FindByAttributes(publicationAttributes);

        if (targetPublicationId.HasValue)
        {
            var targetSectionId = sectionRepository.FindByAttributes(targetPublicationId, sectionAttributes);
            
            if (targetSectionId.HasValue)
            {
                // we found the publication and section,
                // so here we can do whatever we need with the link
                referenceNode.Attributes.Add("PublicationId", targetPublicationId.Value);
                referenceNode.Attributes.Add("SectionId", targetSectionId.Value);
            }
        }
    }
}
```

Seems pretty reasonable, right? Now, recall that the publication has **over a hundred thousand sections** and each section may have hundreds of `refext` nodes.

There are a few things which may jump out at you now:

* Doing (at least) two round-trips to the database for each item in a list of a hundred thousand elements is probably bad
* We are going to the database every time, even if we previously looked up a publication or section with the same set of attributes

## The Solution (second draft)

Okay, so there's a couple things already which we can do to improve this code:

```csharp
var publicationMatches = new Dictionary<string, int?>();
var sectionMatches = new Dictionary<string, int?>();

// loop through the sections to get refext nodes
foreach (var section in publication.Sections) 
{    
    // loop through the refext nodes to resolve references
    foreach (var referenceNode in publication.Sections.SelectNodes("//refext")) 
    {
        var publicationAttributes = new Dictionary<string, string>();
        var sectionAttributes = new Dictionary<string, string>();

        foreach (var attribute in referenceNode.Attributes) 
        {
            switch (attribute.Name)
            {
                case "REFLOC"
                    var tokens = attribute.Value.Split('-');
                    // we don't care about tokens[0] because
                    // it's redundant
                    sectionAttributes.Add("CHAPNBR", tokens[1]);
                    sectionAttributes.Add("SECTNBR", tokens[2]);
                    sectionAttributes.Add("FUNC", tokens[3]);
                    sectionAttributes.Add("SEQ", tokens[4]);
                    sectionAttributes.Add("PGBLKNBR", tokens[5]);
                    break;

                default:
                    publicationAttributes.Add(attribute.Name, attribute.Value);
                    break;
            }
        }

        var publicationAttributeHash = GetAttributeSetHash(publicationAttributes);
        if (!publicationMatches.ContainsKey(publicationAttributeHash))
        {
            publicationMatches.Add(publicationAttributeHash, publicationRepository.FindByAttributes(publicationAttributes));
        }

        if (!publicationMatches[publicationAttributeHash].HasValue)
        {
            var sectionAttributeHash = GetAttributeSetHash(sectionAttributes);
            if (!sectionMatches.ContainsKey(sectionAttributeHash))
            {
                sectionMatches.Add(sectionAttributeHash, sectionRepository.FindByAttributes(targetPublicationId.Value, sectionAttributes));
            }
                        
            if (sectionMatches[sectionAttributeHash].HasValue)
            {
                // we found the publication and section,
                // so here we can do whatever we need with the link
                referenceNode.Attributes.Add("PublicationId", targetPublicationId.Value);
                referenceNode.Attributes.Add("SectionId", targetSectionId.Value);
            }
        }
    }
}

private string GetAttributeSetHash(IDictionary<string, string> attributeSet)
{
    // here we generate a hash of all the key/value pairs so
    // that we don't perform the same lookup multiple times
    var sb = new StringBuilder();

    foreach(var item in attributeSet)
    {
        sb.Append(item.Key);
        sb.Append(item.Value);        
    }

    var md5 = Security.Cryptography.MD5.Create();
    var hash = md5.ComputeHash(Encoding.Default.GetBytes(sb.ToString()));
    sb.Clear();

    for(int i = 0; i < hash.Length; i++)
    {
        sb.Append(hash[i].ToString("x2"));
    }

    return sb.ToString();
}
```

Now we're storing the database results in a pair of dictionaries as we loop through the sections, this way we don't go to the database to do the same lookup thousands of times. There's still a lot of complexity hidden in those repository calls though, which we'll step through in [the next part](http://www.bradwestness.com/2017/11/07/the-pit-of-poor-performance-part-2/).