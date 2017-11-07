---
layout: post
title: The Pit of Poor Performance - Part 2
---

In the first part of this post, I laid out the problem at hand and the code for some of the more high-level business logic. I left off by mentioning that the calls to the "repository" classes were hiding complexity which resulted in disastrously poor performance. In this post, I'll dig into those methods and how I ultimately refactored them to increase the performance by over an order of magnitude.

## The Problem

So where we left off last time was that we had two sets of attributes, one set was related to a publication, and the other to a section of a publication. 

````csharp
var targetPublicationId = publicationRepository.FindByAttributes(publicationAttributes);

var targetSectionId = sectionRepository.FindByAttributes(publicationId, sectionAttributes);
````

The original implementation of the first method looked something like this:

````csharp
public int FindByAttributes(IDictionary<string, string> publicationAttributes)
{
    var matches = new Dictionary<int, int>();

    foreach (var attribute in publicationAttributes)
    {
        var publicationIds = _dbContext.PublicationAttributes
            .Where(x => 
                x.AttributeKey.Equals(attribute.Key) &&         
                x.AttributeValue.Equals(attribute.Value)
            )
            .Select(x => x.PublicationId)
            .ToArray();

        foreach (var id in publicationIds)
        {
            if (!matches.ContainsKey(id))
            {
                matches.Add(id, 0);
            }
            
            matches[id]++;
        }
    }

    // get the publication ID where all attributes
    // were matched
    var bestMatch = matches.First(x => 
        x.Value.Equals(publicationAttributes.Count())
    );

    return bestMatch.Key;
}
````

So, for each attribute in the set, we get the IDs for all publications in the database that have that attribute with the same value. Then, after we've done this for all the attributes, we pick the publication who had a match for every attribute in the set as the best match for the target of the link.

We then repeat this process for the section attributes:

````csharp
public int FindByAttributes(int publicationId, IDictionary<string, string> sectionAttributes)
{
    var matches = new Dictionary<int, int>();

    foreach (var attribute in sectionAttributes)
    {
        var sectionIds = _dbContext.SectionAttributes.Where(x =>
                x.PublicationId.Equals(publicationId) &&
                x.AttributeKey.Equals(attribute.Key) &&
                x.AttributeValue.Equals(attribute.Value)
            )
            .Select(x => x.SectionId)
            .ToArray();

        foreach (var id in sectionIds)
        {
            if (!matches.ContainsKey(id))
            {
                matches.Add(key, 0);
            }

            matches[key]++;
        }
    }

    var bestMatch = matches.First(x =>
        x.Value.Equals(sectionAttributes.Count())
    );

    return bestMatch.Key;
}
````

Now, you can probably see the performance hit here. We go to the database once for each publication attribute, and once for each section attribute, and if you remember from the first part of this post, we do this process *hundreds of thousands of times* in a single operation.

## The Pit of Poor Performance

This is where we finally get to the title of this post. The reason these methods were written this way is because it was the most obvious and straightforward way to solve this problem using the tools at hand. 

The object/relational mapper (or ORM)* did not provide any other way to do this sort of lookup-by-matching-a-set-of-attributes operation, and so this one was used even though it's pretty obviously going to cause performance problems with large datasets.

Similar to the concept of the "[pit of success](https://blog.codinghorror.com/falling-into-the-pit-of-success/)," this is a "pit of poor performance" that many ORMs and other tools can cause developers to fall into. The tool doesn't provide a good way to do something, so you do it in a bad way because it's the most obvious.

The only way to solve this particular problem in a way that isn't horrible for performance with large datasets that I can think of involves constructing a rather gnarly ad-hoc SQL query which does intersects among a bunch of subqueries, which is definitely not something that ORMs tend to excel at. 

_* (Entity Framework in this case, but it would've been true for any of them)_

## Lessons Learned

So basically the tool was more of a hinderance than a help in this instance, as it led the developer down a path that had everything to do with how the tool wanted to work and nothing to do with a good approach to solving the problem.

As the old saying goes, only a poor craftsman blames his tools, but the other old aphorism which applies here is that when all you have is a hammer, everything looks like a nail. 

That is to say, using an O/RM as a convenience is perfectly fine, but don't become convinced that just because you use an O/RM, you *must* do all data reading and writing through the O/RM. Some times you need to  [look past the abstraction](https://www.hanselman.com/blog/PleaseLearnToThinkAboutAbstractions.aspx) and get at the plumbing under the sink in order to do a job the right way.

## Bonus - The Solution

For posterity, here's what the SQL query that I ended up writing to solve this problem looks like:

````sql
declare @publicationId int

select @publicationId = top 1 [PublicationId] from (
    select distinct [PublicationId] from [dbo].[PublicationAttribute]
    where [AttributeKey] = @publicationAttributeKey1
    and [AttributeValue] = @publicationAttributeValue1

    intersect

    select distinct [PublicationId] from [dbo].[PublicationAttribute]
    where [AttributeKey] = @publicationAttributeKey2
    and [AttributeValue] = @publicationAttributeValue2

    -- repeat for however many publication attributes there are
)

select top 1 [SectionId] from (
    select distinct [SectionId] from [dbo].[SectionAttribute]
    where [PublicationId] = @publicationId
    and [AttributeKey] = @sectionAttributeKey1
    and [AttributeValue] = @sectionAttributeValue1

    intersect

    select distinct [SectionId] from [dbo].[SectionAttribute]
    where [PublicationId] = @publicationId
    and [AttributeKey] = @sectionAttributeKey2
    and [AttributeValue] = @sectionAttributeValue2

    -- repeat for however many section attributes there are
)
````

To do this with Entity Framework was a little tricky, because it required using a `StringBuilder` to generate the SQL query, and also figuring out how to pass a dynamically-built list of parameters into the SQL query. 

That looks something like this:

````csharp

public int FindSectionId(IDictionary<string, string> publicationAttributes, IDictionary<string, string> sectionAttributes)
{
    var parameterList = new List<SqlParameter>();
    var query = new StringBuilder();

    query.AppendLine("declare @publicationId int");
    query.AppendLine("select @publicationId = [PublicationId] from (");

    for (var i = 0; i < publicationAttributes.Count; i++)
    {
        if (i > 0)
        {
            query.AppendLine("intersect");
        }

        var attributeKeyParameter = new SqlParameter($"publicationAttributeKey{i}", publicationAttributes[i].Key);
        parameterList.Add(attributeKeyParameter);

        var attributeValueParameter = new SqlParameter($"publicationAttributeValue{i}", publicationAttributes[i].Value);
        parameterList.Add(attributeValueParameter);

        query.AppendLine("select distinct [PublicationId] from [dbo].[PublicationAttribute]");
        query.AppendLine($"where [AttributeKey] = {attributeKeyParameter.ParameterName}");
        query.AppendLine($"and [AttributeValue] = {attributeValueParameter.ParameterName}");
    }

    query.AppendLine(")");

    query.AppendLine("select top 1 [SectionId] from (");

    for (var i = 0; i < sectionAttributes.Count; i++)
    {
        if (i > 0)
        {
            query.AppendLine("intersect");
        }

        var attributeKeyParameter = new SqlParameter($"sectionAttributeKey{i}", sectionAttributes[i].Key);
        parameterList.Add(attributeKeyParameter);

        var attributeValueParameter = new SqlParameter($"sectionAttributeValue{i}", sectionAttributes[i].Value);
        parameterList.Add(attributeValueParameter);

        query.AppendLine("select distinct [SectionId] from [dbo].[SectionAttribute]");
        query.AppendLine("where [PublicationId] = @publicationId");
        query.AppendLine($"and [AttributeKey] = {attributeKeyParameter.ParameterName}");
        query.AppendLine($"and [AttributeValue] = {attributeValueParameter.ParameterName}");
    }

    query.AppendLine(")");

    return _dbContext.Database.SqlQuery<int>(
            query.ToString(), 
            parameterList.Cast<object>().ToArray()
        )
        .FirstOrDefault();
}
````