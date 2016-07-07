---
layout: post
title: Build-time Minification of Web Assets in ASP.NET
---

For a recent project, I wanted to do build-time minification of
the CSS and JavaScript files that are part of an ASP.NET web application,
so that I could deploy pre-minified files rather than doing the
work to minify files at AppStart or during page load.

There are a lot of solutions to this, such as [Grunt](http://gruntjs.com/) or
[gulp.js](http://gulpjs.com/), or the new [Bundler & Minifier Visual Studio extension](https://visualstudiogallery.msdn.microsoft.com/9ec27da7-e24b-4d56-8064-fd7e88ac1c40)
by [Mads Kristensen](http://madskristensen.net/). These are all great options, though sometimes
grunt and gulp can feel a bit like [using a crane to crush a
fly](https://youtu.be/o0AOG7ciuJo) if all you want is minification (and require adding the notoriously
complex graph of dependencies that is [Node.js](https://nodejs.org/) to your application). 

The Bundler & Minifier plugin is a little more focused on this task,
and I would definitely recommend it if you are starting a new project
today. However, in my case I was working with a large existing application.
The Bundler & Minifier plugin supports [globs](https://en.wikipedia.org/wiki/Glob_%28programming%29) for input files, but only
if you combine them into a single output file. I needed something that could
minify all the JavaScript and CSS files in the application in-place so that
I didn't have to re-write thousands of JavaScript and CSS files (most of 
which were written for use on a single page and use global variables and styles
that would conflict if bundled). With the advent of HTTP/2, bundling is 
a little less necessary anyhow, since
[multiplexing of requests and responses](https://en.wikipedia.org/wiki/Multiplexing) means that having many external
files on a page is much less costly than it was with HTTP 1.x.

## Build-time Minification

So it seemed I was down to rolling my own solution. This led me to researching
[MSBuild Task Writing](https://msdn.microsoft.com/en-us/library/t9883dzc.aspx).
The jist is this: you can create a task that runs at a specified point during
your project's comppilation/build/publish operation. You just have to implement
a class that inherits from the `Microsoft.Build.Utilities.Task` class and
implements a signle method: `Execute()`. Here's what I came up with:

```csharp
using Microsoft.Build.Utilities;
using NUglify;
using NUglify.Css;
using NUglify.JavaScript;
using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

namespace MyWebApp
{
    public class MinifyWebAssets : Task
    {
        public override bool Execute()
        {
            var projectDirectory = Path.GetDirectoryName(BuildEngine.ProjectFileOfTaskNode);
            bool success = true;

            success &= MinifyJavaScripts(projectDirectory);
            success &= MinifyCascadingStyleSheets(projectDirectory);

            return success;
        }

        private bool MinifyJavaScripts(string projectDirectory)
        {
            var success = true;
            var files = Directory.EnumerateFiles(projectDirectory, "*.js", SearchOption.AllDirectories);
            var settings = new CodeSettings
            {
                LocalRenaming = LocalRenaming.CrunchAll,
                AlwaysEscapeNonAscii = true,
                PreserveFunctionNames = true,
                PreserveImportantComments = false,
                EvalTreatment = EvalTreatment.MakeAllSafe
            };

            foreach (var file in files)
            {
                if (!file.EndsWith(".min.js"))
                {
                    try
                    {
                        var source = File.ReadAllText(file);
                        if (source.Length > 0)
                        {
                            CleanExistingCompressedFiles(file);
                            var uglifyResult = Uglify.Js(source, settings);
                            var compressedFileContents = uglifyResult.Code?.Trim();

                            if (!uglifyResult.HasErrors && !string.IsNullOrEmpty(compressedFileContents))
                            {
                                var compressedFilePath = Path.Combine(Path.GetDirectoryName(file), Path.GetFileNameWithoutExtension(file) + "." + GetMD5Hash(compressedFileContents) + ".build.min.js");
                                File.WriteAllText(compressedFilePath, compressedFileContents, new UTF8Encoding(false));
                                GzipFile(compressedFilePath);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.LogErrorFromException(ex);
                        success = false;
                    }
                }
            }

            return success;
        }

        private bool MinifyCascadingStyleSheets(string projectDirectory)
        {
            var success = true;
            var files = Directory.EnumerateFiles(projectDirectory, "*.css", SearchOption.AllDirectories);
            var settings = new CssSettings
            {
                CommentMode = CssComment.Hacks,
                OutputMode = OutputMode.SingleLine,
                ColorNames = CssColor.Hex,
                IndentSize = 2
            };

            foreach (var file in files)
            {
                if (!file.EndsWith(".min.css"))
                {
                    try
                    {
                        var source = File.ReadAllText(file);
                        if (source.Length > 0)
                        {
                            CleanExistingCompressedFiles(file);
                            var uglifyResult = Uglify.Css(source, settings);
                            var compressedFileContents = uglifyResult.Code?.Trim();

                            if (!uglifyResult.HasErrors && !string.IsNullOrEmpty(compressedFileContents))
                            {
                                var compressedFilePath = Path.Combine(Path.GetDirectoryName(file), Path.GetFileNameWithoutExtension(file) + "." + GetMD5Hash(compressedFileContents) + ".build.min.css");
                                File.WriteAllText(compressedFilePath, compressedFileContents, new UTF8Encoding(false));
                                GzipFile(compressedFilePath);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        //Log.LogErrorFromException(ex);
                        success = false;
                    }
                }
            }

            return success;
        }

        private static void CleanExistingCompressedFiles(string filePath)
        {
            var directory = Path.GetDirectoryName(filePath);
            var noExtension = Path.GetFileNameWithoutExtension(filePath);
            var extension = Path.GetExtension(filePath);
            var filesToDelete = Directory.EnumerateFiles(directory, noExtension + ".*.build.min" + extension + "*", SearchOption.TopDirectoryOnly);

            foreach (var fileToDelete in filesToDelete)
            {
                File.Delete(fileToDelete);
            }
        }

        private static string GetMD5Hash(string contents)
        {
            string md5Hash;

            using (var md5 = MD5.Create())
            {
                md5Hash = BitConverter.ToString(md5.ComputeHash(Encoding.Default.GetBytes(contents)))
                    .Replace("-", "")
                    .ToLower();
            }

            return md5Hash;
        }

        private static void GzipFile(string filePath)
        {
            var gzipFilePath = filePath + ".gz";

            using (var inputStream = File.OpenRead(filePath))
            using (var outputStream = File.OpenWrite(gzipFilePath))
            using (var gzipStream = new GZipStream(outputStream, CompressionLevel.Optimal))
            {
                inputStream.CopyTo(gzipStream);
            }
        }
    }
}
```

This task uses [NUglify](https://github.com/xoofx/NUglify) (the same library the
Bundler & Minifier extension uses under the hood) to create minified versions of
all of the `.js` and `.css` files inside your project directory (the project
directory is inferred from the `BuildEngine.ProjectFileOfTaskNode` property, which
contains the path to your project's `.csproj` file).

Here, I'm creating the minified files at the same location of the original file,
but appending an MD5 hash and `.build.min` suffix to the filename. This serves two
purposes: the MD5 hash ensures that the user's browser will always request the new
file if the contents have changed (no more telling users to try hitting CTRL+F5 or
clearing their browser's cache!), and also make it easy to visually distinguish which
files are minified or not based on the `.build.min` portion of the filename.

The files are then passed through GZip compression. The trick here is that IIS's
static file hanlder will automatically serve up the GZipped file if it exits in 
the same directory as the non-GZipped version. So for instance, if you have the
following files deployed to your web server:

* /myapp/js/myfile.js
* /myapp/js/myfile.min.js
* /myapp/js/myfile.min.js.gz

When the browser makes a request for `myapp/js/myfile.min.js`, IIS will notice that there's a file
with the same name in the same folder except with an additional `.gz` suffix, and
serve that file to the user. This prevents IIS from having to GZip the file at runtime,
which should reduce server load and response time.

In order for the task to be executed, we need to add a `<UsingTask />` statement
to the project's `.csproj` file. This requires opening the file in a text editor
(or something like Visual Studio Code). If you look near the bottom, you should see
some commented-out sample `UsingTask` statements. Here's the final configuration I wound
up with:

```xml
<UsingTask TaskName="MyWebApp.MinifyWebAssets" AssemblyFile="bin\MyWebApp.dll" />
<Target Name="AfterCompile">
  <MinifyWebAssets ContinueOnError="WarnAndContinue" />
</Target>
``` 

I found that using the `AfterCompile` target worked best for me,
as when using `AfterBuild` the generated files were not included
with the application publish. You may wish to try playing with [the
various available targets](https://msdn.microsoft.com/en-us/library/ms366724.aspx).

## Deploying the Minified Files

So, now that I had the files being generated at build time, I needed
a way to get MSBuild to include the minified files along with a publish.
Remember, the files are not actually part of the project (and in fact I added
`.gitignore` rules to prevent any of the `.build.min.*` files from being
committed to my source code repository).  

For that, I found some documentation on the ASP.NET MVC website about
[deploying extra files](http://www.asp.net/mvc/overview/deployment/visual-studio-web-deployment/deploying-extra-files)
during an msdeploy (although I don't think it's really specific to MVC at all).

To do that, I needed to add another bit of XML to the end of my application's
`.csproj` file, again using Notepad or VS Code.

```XML
<Target Name="CustomCollectFiles">
    <ItemGroup>
        <_CustomFiles Include="**\*.build.min.*" Exclude="bin\**\*.build.min.*;obj\**\*.build.min.*" /> 
        <FilesForPackagingFromProject Include="%(_CustomFiles.Identity)">
            <DestinationRelativePath>%(RecursiveDir)%(Filename)%(Extension)</DestinationRelativePath>
        </FilesForPackagingFromProject>
    </ItemGroup>
</Target>
<PropertyGroup>
    <CopyAllFilesToSingleFolderForPackageDependsOn>
        CustomCollectFiles;
        $(CopyAllFilesToSingleFolderForPackageDependsOn);
    </CopyAllFilesToSingleFolderForPackageDependsOn>
    <CopyAllFilesToSingleFolderForMsdeployDependsOn>
        CustomCollectFiles;
        $(CopyAllFilesToSingleFolderForMsdeployDependsOn);
    </CopyAllFilesToSingleFolderForMsdeployDependsOn>
</PropertyGroup>
```

Note the `Exclude` attribute. I found through trial and error that without
the exclude attribute, MSDeploy would recursively keep generating files in
it's temp build folder until a stack overflow occurred.

Now your pre-minified files should get deployed along with your web app despite
not being included in the project and not needing to be checked in to source control!

There was actually one more bit of customization that I needed to do for the
application I was working on, which was re-writing the `<script />` tags at runtime
to point to the minified files when not running in debug mode, but that was
pretty specific to the particular way the app was configured, so I don't know
how valuable that would be to reproduce here.