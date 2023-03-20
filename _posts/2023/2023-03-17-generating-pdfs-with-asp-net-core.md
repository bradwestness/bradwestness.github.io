---
layout: post
title: Generating PDFs with ASP.NET Core and WKHtmlToPDF
categories: [Software,Programming,.NET]
image: content/images/wkhtmltopdf.jpg
---

It's the bane of every web developer's existence (perhaps I'm projecting there?), but if you work on web applications long enough - eventually, you're going to be asked to dynamically generate some PDFs.

## The Alternative Matrix

There are about as many libraries for generating PDFs as there are stars in the galaxy. [PDFSharp](http://www.pdfsharp.com/PDFsharp/), [IronPDF](https://ironpdf.com/), [Aspose PDF](https://products.aspose.com/pdf/), [iText](https://itextpdf.com/), [Docotic](https://bitmiracle.com/pdf-library/), [Winnovative](https://www.winnovative-software.com/), etc. A quick search for "PDF" on NuGet.org finds over 2,700 packages, and that's just the .NET landscape.

You can also generate PDFs directly from XML files, using [XSL:FO](https://www.xml.com/articles/2017/01/01/what-is-xsl-fo/) and [Apache FOP](https://en.wikipedia.org/wiki/Formatting_Objects_Processor), which is just as heavyweight (although powerful) as it sounds. That might be the right solution if you're generating entire books.

But usually you just need to generate a single page, whether it be some kind of report, or order details, or receipt, or what-have-you.

If you're a web developer and you don't want to learn a whole suite of technologies that aren't your core competency just to generate a simple PDF (indeed, XSL:FO is a whole vocation unto itself, separate even from being an XML/XSL expert), I'd recommend generating your PDFs directly from HTML.

And for my money, the best way to do this is by using a web browser's built-in "print to PDF" feature.

## Chromium

{% include figure.html filename="print_to_pdf.png" description="If the web page includes a dedicated print CSS, this works extremely well." %}

Just as you can create a PDF from a web page in the browser's UI by printing and then choosing "Print to PDF" as your target printer, [you can generate PDFs via a "headless" browser](https://stackoverflow.com/questions/46074235/headless-chrome-to-print-pdf), by feeding the browser executable some command-line arguments:

```bash
chrome --headless --disable-gpu --print-to-pdf="C:\Users\Brad\Downloads\my_website.pdf" https://www.bradwestness.com/index.html
```

This works a treat, however it's fairly limited. There are no options, for example, to specify the page size, orientation, margins, etc.

There is, however, another way.

## WKHtmlToPDF

As the name implies, [WKHtmlToPDF](https://wkhtmltopdf.org/) is built from the WebKit engine (read: the same browser engine used in Safari, Chrome, and Edge). It's an open-source native library which comprises just the HTML-to-PDF functionality of the browser in a standalone package.

In .NET land, there are a few ways to invoke it. My favorite is [DinkToPDF](https://github.com/rdvojmoc/DinkToPdf), which is a tiny open-source library which includes all the correct [P/Invoke](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke) wrappers for calling into the native WKHtmlToPDF library's functionality.

This way, you can invoke WKHtmlToPDF's PDF generation functionality with native performance from within the safety of a managed code context in a .NET application, without needing to write things to disk so that you can [shell out to a separate process](https://stackoverflow.com/questions/1817562/execute-a-shell-command-from-a-net-application).

```csharp
var doc = new HtmlToPdfDocument
{
    GlobalSettings = {
        ColorMode = ColorMode.Color,
        Orientation = Orientation.Landscape,
        PaperSize = PaperKind.A4Plus,
    },
    Objects = {
        new ObjectSettings() {
            PagesCount = true,
            HtmlContent = @"Lorem ipsum dolor sit amet, consectetur adipiscing elit. In consectetur mauris eget ultrices  iaculis. Ut                               odio viverra, molestie lectus nec, venenatis turpis.",
            WebSettings = { DefaultEncoding = "utf-8" },
            HeaderSettings = { FontSize = 9, Right = "Page [page] of [toPage]", Line = true, Spacing = 2.812 }
        }
    }
};
```

Sweet! Now we've got dynamically generated PDFs from HTML content, right from within our .NET application. However, we're just passing in a hardcoded HTML string.

Surely there must be some smarter way to build up the HTML we're going to generate our PDF from, rather than just a big, dumb string?

{% include figure.html filename="better_way.gif" description="There's got to be a better way!" %}

## ASP.NET Core Razor Templating

What if I told you that you could use ASP.NET Core's Razor templating engine to generate our HTML first, then pass it to WKHtmlToPdf to turn it into a sweet, sweet Portable Document Format file? Well now you can!

The first step is generating an HTML string from your Razor view, which is fairly simple. I wrote all this as extension methods to the Microsoft.AspNetCore.Mvc.Controller class for convenience:

```csharp
public static async Task<string> RenderViewAsync<TModel>(
    this Controller controller,
    TModel model,
    string? viewName = null,
    bool isPartialView = false)
{
    ArgumentNullException.ThrowIfNull(controller);
    ArgumentNullException.ThrowIfNull(model);

    if (string.IsNullOrEmpty(viewName))
    {
        viewName = controller.ControllerContext.ActionDescriptor.ActionName;
    }

    controller.ViewData.Model = model;

    var viewEngine = controller.GetViewEngine();
    var viewResult = viewEngine.FindView(controller.ControllerContext, viewName, !isPartialView);

    if (!viewResult.Success)
    {
        throw new RazorPdfGenerationException(
            $@"A view with the name ""{viewName}"" could not be found.");
    }

    using var writer = new StringWriter();

    var viewContext = new ViewContext(
        controller.ControllerContext,
        viewResult.View,
        controller.ViewData,
        controller.TempData,
        writer,
        new HtmlHelperOptions());

    await viewResult.View.RenderAsync(viewContext);

    return writer.GetStringBuilder().ToString();
}

public static ICompositeViewEngine GetViewEngine(
    this Controller controller)
{
    ArgumentNullException.ThrowIfNull(controller);

    var viewEngine = controller
        .HttpContext
        .RequestServices
        .GetService<ICompositeViewEngine>();

    if (viewEngine is null)
    {
        throw new RazorPdfGenerationException(
            $"View rendering services have not been configured for this request. Please call {nameof(IServiceCollection)}.AddControllersWithViews() in your application's dependency registration.");
    }

    return viewEngine;
}
```

> Note: `RazorPdfGenerationException` here is just a simple class I created that extends from `Exception`, it's not doing anything special.

Now you've got a method to render an ASP.NET View to a string, now you just need to pass that into a DinkToPdf "converter" instance to render it to a PDF:

```csharp
public static async Task<byte[]> GenerateRazorPdfAsync<TModel>(
    this Controller controller,
    TModel model,
    string? viewName = null,
    GlobalSettings? globalSettings = null,
    HeaderSettings? headerSettings = null,
    FooterSettings? footerSettings = null,
    bool isPartialView = false)
{
    ArgumentNullException.ThrowIfNull(controller);
    ArgumentNullException.ThrowIfNull(model);

    globalSettings ??= new GlobalSettings();
    headerSettings ??= new HeaderSettings();
    footerSettings ??= new FooterSettings();

    var converter = controller.GetRazorPdfConverter();
    var html = await controller.RenderViewAsync(model, viewName, isPartialView);
    var document = new HtmlToPdfDocument
    {
        GlobalSettings = globalSettings,
        Objects =
        {
            new ObjectSettings
            {
                HtmlContent = html,
                PagesCount = true,
                WebSettings =
                {
                    DefaultEncoding = "utf-8"
                },
                HeaderSettings = headerSettings,
                FooterSettings = footerSettings
            }
        }
    };
    var bytes = converter.Convert(document);

    return bytes;
}

public static IConverter GetRazorPdfConverter(
    this Controller controller)
{
    ArgumentNullException.ThrowIfNull(controller);

    var pdfConverter = controller
        .ControllerContext
        .HttpContext
        .RequestServices
        .GetService<IConverter>();

    if (pdfConverter is null)
    {
        throw new RazorPdfGenerationException(
            $"The PDF Generation services have not been configured for this request. Please call {nameof(IServiceCollection)}.{nameof(ServiceCollectionExtensions.AddPdfGeneration)}() in your application's dependency registration.");
    }

    return pdfConverter;
}
```

Finally, the pièce de résistance, an extension method to return a PDF from a controller action just like how you would normally return a `ViewResult` or `FileContentResult`:

```csharp
public static async Task<FileContentResult> RazorPdf<TModel>(
    this Controller controller,
    TModel model,
    string? viewName = null,
    string? downloadFileName = null,
    GlobalSettings? globalSettings = null,
    HeaderSettings? headerSettings = null,
    FooterSettings? footerSettings = null,
    bool isPartialView = false,
    DateTimeOffset? lastModified = null)
{
    ArgumentNullException.ThrowIfNull(controller);
    ArgumentNullException.ThrowIfNull(model);

    var bytes = await controller.GeneratePdfAsync(
        model,
        viewName,
        globalSettings,
        headerSettings,
        footerSettings,
        isPartialView);

    EntityTagHeaderValue? entityTag = null;

    if (lastModified.HasValue)
    {
        var etagValue = $@"""{lastModified.Value.ToUnixTimeSeconds()}""";
        entityTag = new EntityTagHeaderValue(
            etagValue,
            isWeak: true);
    }

    if (!string.IsNullOrEmpty(downloadFileName))
    {
        return controller.File(
            bytes,
            PdfContentType,
            fileDownloadName: downloadFileName,
            lastModified: lastModified,
            entityTag: entityTag);
    }

    return controller.File(
        bytes,
        PdfContentType,
        lastModified: lastModified,
        entityTag: entityTag);
}
```

## Usage

First, you'll just need to wire up the PDF generation in your application's startup configuration:

```csharp
public void ConfigureServices(IServiceCollection services)
{
	// other service registrations

    services.AddSingleton(() => new DinkToPdf.SynchronizedConverter(new PdfTools()));
}
```

Now you can return a PDF generated from a Razor View directly in your ASP.NET Controller method, like this:

```csharp
public class UserController : Controller
{
    [HttpGet]
    public async Task<FileContentResult> PrintReport(
        int userId,
        [FromServices] IUserService userService)
    {
        var model = await userService.GetReportDataAsync(userId);

		// Renders the Razor view at ~/Views/User/PrintReport.cshtml (by default),
		// then generates a PDF from the HTML, and returns the PDF as a FileContentResult
		return this.RazorPdf(
			model,
			downloadFileName: "user_report.pdf",
			lastModified: DateTimeOffset.UtcNow);
    }
}
```

Now, if you visit the `GET: /user/report/123` endpoint of your app, the Report action will be invoked, which will render the view at `~/Views/User/Report.cshtml` (by default), and then generate a PDF from the resulting HTML, before returning it as a FileContentResult to the browser.

## Other Considerations

If you're running on a Linux host, you'll need to make sure the dependencies that WKHtmlToPdf needs are installed on the host machine. If you're deploying via Docker, you can do this in your Dockerfile:

```bash
RUN apt-get update && apt-get install -y fontconfig wkhtmltopdf
```

Also, any fonts you're using in your HTML page need to be installed on the _host machine_, since the HTML is rendered on the host machine when generating PDFs instead of on the client machine, as it is when viewing HTML pages in the browser normally.

First, include your fonts as content resources in your .csproj file, here I'm outputting them into a `fonts` directory in the build output:

```xml
<ItemGroup>
    <Content Include="fonts\MyFont.ttf">
        <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </Content>
</ItemGroup>
```

Then, your Dockerfile, you can install the fonts from the build output on the host machine:

```bash
# Install included fonts and refresh the font cache
WORKDIR /app
COPY --from=build-env /app/out/fonts/ /usr/share/fonts/
RUN fc-cache -f -v
```

I packaged up the above as a little library called [RazorDinkToPdf](https://github.com/bradwestness/razor-dink-to-pdf), which is [available on NuGet](https://www.nuget.org/packages/RazorDinkToPdf/) if you like.