---
layout: post
title: Introducing Dossier.NET - A Transactional File Manipulation Library
categories: [Software, .NET, Programming]
---

Here's a new project I just started over the weekend that I'm
pretty excited about: it's called Dossier.NET and it's a transactional
file management library for the .NET Framework.

Why "Dossier"? Let's ask Mirriam-Webster:

> ## dos·si·er
>
> [ˈdôsēˌā, ˈdäsēˌā]
>
> **NOUN**
>
> a collection of documents about a particular person, event, or subject: 

I was inspired by the transaction mechanism in the excellent
[Entity Framework ORM](https://msdn.microsoft.com/en-us/data/ef.aspx), 
which looks something like this:

```csharp
using(var dbContext = new DbContext())
{
    using(var trx = dbContext.Database.BeginTransaction())
    {
        try
        {
            dbContext.Users.Add(new User("John", "Smith"));

            var user = _dbContext.Users.Single(x => x.FirstName == "Jane"));
            dbContext.Users.Remove(user);

            dbContext.SaveChanges();
            trx.Commit();
        }
        catch (Exception)
        {
            trx.Rollback();
        }
    }
}
```

The idea is that you can perform any number of operations, but if any of them fail
some reason, you can roll back the transaction and the database will return to the
state it was in before you began mucking about.

What if we had the same thing for file and directory operations? Say your app
does some complex set of operations involving creating directories, writing files
into them and moving things around, but if any of those fails you want to return
to the state it was before you had done anything, just like a database transaction.

Enter Dossier.NET, which will build up a queue of operations in your "transaction,"
and give you the option to commit or roll back your changes. The syntax should
look very familiar for anyone familiar with Entity Framework:

```csharp
using(var fsContext = new Dossier.FileSystemContext())
{
    using(var trx = fsContext.BeginTransaction())
    {
        try
        {
            fsContext.CreateDirectory(".\\my-cool-folder");
            fsContext.WriteFile(".\\my-cool-folder\\hello-world.txt", "Hello world!");
            fsContext.MoveFile(".\\my-cool-folder\\hello-world.txt", ".\\another-folder\\hello-world.txt");

            trx.Commit();
        }
        catch(Exception)
        {
            trx.Rollback();
        }
    }
}
```  

Say for example the first two operations (creating the `my cool folder`
directory and creating the `hello-world.txt` file) complete successfully. 

However, the third operation fails for some reason. Maybe the `another-folder`
directory already exists but the user doesn't have write access to it.  This
will throw an exception, which will then cause the transaction to roll back
each change in reverse order. The hello-world.txt file will be removed, and then
the `my-cool-folder` directory will be deleted.

By default, each action taken against the transaction object stores a backup
of the previous state in memory as a byte array. So if you overwrite a file,
the previous contents of the file are stored in memory until the transaction
is committed or rolled back (or the object is disposed, if you don't commit a
transaction before it is disposed, it will automatically roll back any changes).

You can also specify a temporary directory, in which case the rollback data
will be stored in temp files in that directory rather than in memory (useful
if you're handing a lot of data). To do so, simply pass in a path to the
desired temporary directory when creating the `FileSystemContext` object.

I think this is a pretty neat way to solve this particular problem. The project
is [open source on Github](https://github.com/bradwestness/dossier-dot-net)
with a super-permissive MIT license, and there's a 
[package on NuGet](https://www.nuget.org/packages/dossier-dot-net/), 
so you can easily integrate it into your own projects.