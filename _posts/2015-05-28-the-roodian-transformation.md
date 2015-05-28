---
layout: post
title: The Roodian Transformation
---

It's easy to wind up with redundant address data when operating institutional systems: people register more than once with different e-mail addresses, they register for other users and don't have all their information correct, they make a typo or use an abbreviation in their billing address but spell their home address out completely.

There are many approaches to attemp to "[fuzzy match](http://en.wikipedia.org/w/index.php?title=Record_linkage&redirect=no#Probabilistic_record_linkage)" address data, this one is named for one of my co-workers, [Kip Rood](http://www.kiprood.com/), who came up with it. 

Take two addresses:

> 1301 Kinnickinnic Road

> Apartment #2

> Tucson, AZ 53715

and

> 1301 kk rd apt 2

> tuscon az 53715

Despite the cosmetic differences, if you mailed a letter to both of these addresses they would wind up in the same place. So how do you programmatically detect that they're equivalent?

What Kip noticed is that people tend to get the numbers right, all the weird inconsitenceis are usually with the punctuation, abbreviations, and spelling (notice how Tucson is spelled in the second address). With that in mind, he decided to strip out all the problematic data and distill the address down to it's "Roodian value."

To do so, you use the following steps:

1. Replace all line breaks, punctuation and non-alphanumeric characters with a single space
2. If an alphabetical (non-numeric) section is only one letter, discard it
3. If an alphabetical (non-numeric) section is multiple letters long, keep only the first letter
4. Remove all spaces and make everything uppercase

So, with our example addresses above:

#### 1. Replace all line breaks, punctuation and non-alphanumeric characters with a single space

> 1301 Kinnickinnic Road Apartment 2 Tucson AZ 53715

> 1301 kk rd apt 2 tuscon az 53715

#### 2. If an alphabetical (non-numeric) section is only one letter, discard it

> No change for this example (this step is primarily to get rid of "P.O. Box" spelling inconsistencies)

#### 3. If an alphabetical (non-numeric) section is multiple letters long, keep only the first letter

> 1301 K R A 2 T A 53715

> 1301 k r a 2 t a 53715

#### 4. Remove all spaces and make everything uppercase

> 1301KRA2TA53715

> 1301KRA2TA53715

---

As you can see, by step 3 our two values are already equivalent (barring case sensitivity). There are obviously a lot of other edge cases and address weirdnesses you could potentially account for, but this simple method will get you 90% of the way there, without too much complexity.

The nice thing with this method is that once you generate the "Roodian" value of an address, you can easily throw that into a column in your database along with the rest of the address info. That column can then be indexed, so you have a really performant way to check if an address already exists when saving a new one, or to weed out duplicates that are already in the system.

Here's the Roodian transform implemented in C#. My team put this in our shared utilities library so we know that all of our apps are using a consistent implementation of the Roodian transform, so we could potentially compare values between our apps since they've been generated the same way.

<pre><code class="language-csharp">
/// <summary>
/// Provides a method for fuzzy-matching addresses to determine whether they
/// are likely matches even if the two are spelled differently or abbreviated.
/// </summary>
public static class Roodian
{
    #region Constants

    private static readonly Regex _cleanser = new Regex(@"[^A-Z0-9 ]", RegexOptions.Compiled | RegexOptions.Multiline);

    private static readonly Regex _numeric = new Regex(@"^\d+$", RegexOptions.Compiled);

    private static readonly Regex _alpha = new Regex(@"^[A-Z]{2,}$", RegexOptions.Compiled);

    #endregion

    #region Public Methods

    /// <summary>
    /// Calculates the Roodian value of an address string.
    /// </summary>
    public static string Get(string address)
    {
        var roodian = new StringBuilder();
        var tokens = Cleanse(address).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var token in tokens)
        {
            // if the whole token is numeric,
            // append the whole thing
            if (_numeric.IsMatch(token))
            {
                roodian.Append(token);
            }

            // if the token is a string of at least two alpha characters,
            // append the first character
            if (_alpha.IsMatch(token))
            {
                roodian.Append(token.Substring(0, 1));
            }
        }

        return roodian.ToString();
    }

    /// <summary>
    /// Convenience method to get the Roodian value of a
    /// collection of fields (i.e. Address1, Address2, City, State, etc)
    /// </summary>
    public static string Get(params string[] fields)
    {
        string address = string.Empty;

        if (fields != null)
        {
            address = string.Join(" ", fields);
        }

        return Get(address);
    }

    #endregion

    #region Private Methods

    private static string Cleanse(string input)
    {
        var output = _cleanser.Replace((input ?? string.Empty).ToUpperInvariant(), " ").Trim();
        return output;
    }

    #endregion
}
</code></pre>