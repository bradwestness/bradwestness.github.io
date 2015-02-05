---
layout: post
title: EPPlusEnumerable - Easily Create Multi-Worksheet Excel Spreadsheets from any .NET object collection
---

Let's say you're working on an ASP.NET web app and want to create a report of all users and orders. I created a little utility built on top of the excellent (and open source) [EPPlus](http://epplus.codeplex.com/) to make this as easy as possible.

<pre><code class="language-csharp">
public ActionResult DownloadReport()
{
    var data = new List<ienumerable<object>>();

    using(var db = new DataContext())
    {
        data.Add(db.Users.OrderBy(x => x.Name).ToList());
        data.Add(db.Orders.OrderByDescending(x => x.Date).ToList());
    }

    var bytes = Spreadsheet.Create(data);
    return File(bytes, "application/vnd.ms-excel", "MySpreadsheet.xslx");
}
</code></pre>

That will give you a nicely-formatted Excel spreadsheet with tabs for both "Users" and "Orders," like so:

![output](https://raw.githubusercontent.com/bradwestness/EPPlusEnumerable/master/output.png)

There's also a `SpreadsheetLinkAttribute` class which you can use to generate links between tabs on your spreadsheet.

<pre><code class="language-csharp">
[DisplayName("Orders")]
public class Order
{
    public int Number { get; set; }
    public string Item { get; set; }
    [SpreadsheetLink("Customer", "Name")]
    public string Customer { get; set; }
    public decimal Price { get; set; }
    public DateTime Date { get; set; }
}
</code></pre>

In this example, the "Customer" values in the Orders tab will be linked to the corresponding Customers tab row where the Name is equal to the value of the Order object's Customer property.
![links](https://raw.githubusercontent.com/bradwestness/EPPlusEnumerable/master/links.png)
P.S. `DisplayName` or `Display(Name="")` attributes will be used for worksheet names if used on the class, or column headers if used on a property.

The code is [available on Github](https://github.com/bradwestness/EPPlusEnumerable), and can be easily [installed in your project via NuGet](http://www.nuget.org/packages/EPPlusEnumerable/).