---
layout: post
title: Mixing and Matching .csproj Formats
---

The Visual Studio Build Tools 15.x installers do not include all the necessary dependencies to build a solution containing projects using both the classic "Full Framework" .csproj format and the new "VS 2017" .csproj format out of the box.

The benefit of using the newer format where possible (in class libraries and console applications), is that the .csproj no longer requires listing every individual file in the project, which reduces merge conflicts and auto-merge failures that break the build and halt development when merging in feature branches.

In order to get the solution building on our CI server, it was necessary to do the following:

## Install Visual Studio Build Tools 15.3 (or higher)
[https://www.visualstudio.com/thank-you-downloading-visual-studio/?sku=BuildTools&rel=15](https://www.visualstudio.com/thank-you-downloading-visual-studio/?sku=BuildTools&rel=15)

## Install the .NET Core 2.0 SDK (or later)
[https://aka.ms/dotnet-sdk-2.0.0-win-gs-x64](https://aka.ms/dotnet-sdk-2.0.0-win-gs-x64)

### Copy the "Sdks" folder from the .NET Core 2.0 install location to the MSBuild installation:
Copy from "C:\Program Files\dotnet\sdk\2.0.0\" to "C:\Program Files(x86)\Microsoft Visual Studio\2017\BuildTools\MSBuild\15.0\"

### Copy the NuGet Targets folder from a machine that has the full VS 15.3 (or later) IDE installed on it
Copy from "C:\Program Files (x86)\Microsoft Visual Studio\2017\Professional\Common7\IDE\CommonExtensions\Microsoft\" to "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\Common7\IDE\CommonExtensions\Microsoft\"

## NuGet Restore

The build scripts need to perform two different methods of NuGet Restore for the different project types.

````
rem *********************************************************************
rem Restore NuGet Packages 1 - Use MSBuild with /t:restore switch for projects that use the new .csproj format
rem *********************************************************************
"%MSBUILD%" MySolution.sln /t:restore /p:RestoreConfigFile=..\.nuget\Nuget.config;RestorePackagesPath=packages;RestoreNoCache=true

rem *********************************************************************
rem Restore NuGet Packages 2 - Use NuGet.exe for old-style .csproj projects
rem *********************************************************************
.nuget\nuget.exe restore MySolution.sln -PackagesDirectory packages -nocache -configfile .nuget\nuget.config -verbosity detailed
````

I can't guarantee these steps will work for everyone, but they have the "Works on My Machine" guarantee, so I'm providing them here for posterity in case anyone else is looking to do this.