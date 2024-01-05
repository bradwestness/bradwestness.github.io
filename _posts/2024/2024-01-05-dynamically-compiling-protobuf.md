---
layout: post
title: Dynamically Compiling Protobuf Schemas from Confluent Schema Registry
categories: [Software,Programming]
image: content/images/confluent-schema-registry.png
---

We're using Kafka in the [Confluent Cloud](https://confluent.cloud/) platform with Protobuf schemas a lot at work, and a recent need that came up was for a testing tool which would enable our QA engineers to produce messages to our topics at will, without needing to write a bunch of code first.

You can do this for Kafka topics that use JSON in the Confluent UI pretty easily, as the message you're producing is essentially just a big string - Kafka doesn't really care that it's JSON.

However, if you're using Protobuf, things become a bit trickier, as the messages need to be compiled into a byte array, which is not a human-friendly way to produce messages via a Web UI.

I had a thought - what if we built a custom tool that could:

1. Show the user a list of topics
1. Grab the schema for a given topic from the Confluent Schema Registry
1. Dynamically compile the schema into C# types
1. Parse JSON messages into the Protobuf format for the topic, and
1. Produce fully compiled Protobuf messages to the topic, in a Schema-registry aware fashion

To accomplish this took a bit of trial and error, and there's a dearth of applicable information online, so I figured I'd document up the tricksy parts.

## Downloading Schemas

If you're using the [Confluent.Kafka](https://www.nuget.org/packages/Confluent.Kafka) NuGet package to talk to your [Schema Registry](https://www.nuget.org/packages/Confluent.SchemaRegistry.Serdes.Protobuf), as we are, it's pretty straightforward.

You can just use an instance of the `ISchemaRegistryClient` that you'd normally pass into a `ProducerBuilder` instance to publish messages to a topic, but instead of just passing it into a Kafka client, use the `ISchemaRegistryClient` directly, to retrieve schemas from the Confluent API:

```csharp
using Confluent.SchemaRegistry;

var config = new SchemaRegistryConfig
{
    Url = "https://example.com",
    BasicAuthCredentialsSource = AuthCredentialsSource.UserInfo,
    BasicAuthUserInfo = $"{username}:{password}",
};

var schemaRegistryClient = new CachedSchemaRegistryClient(config);

// Topic schemas are named as [topicname]-key and [topicname]-value by default
var valueSchema = await TryGetLatestSchema($"{topicName}-value");

private async Task<RegisteredSchema?> TryGetLatestSchema(string subject)
{
    try
    {
        return await schemaReigstryClient.GetLatestSchemaAsync(subject);
    }
    catch (SchemaRegistryException ex)
    when (ex.StatusCode == HttpStatusCode.NotFound || ex.ErrorCode == 40401)
    {
        // there is no schema for the specified subject
        return null;
    }
}
```

This will get you a `RegisteredSchema` object representing the Protobuf schema of the topic.

## Persisting Schemas to Disk

Now, we'll need to persist the schemas for the topic to disk so that we can compile them using Protoc.

```csharp
private async Task SaveSchemaAndReferences(RegisteredSchema schema, string outputDirectory, CancellationToken cancellationToken)
{
    var schemaFileName = schema.Subject;

    // Ensure that the filename has a ".proto" extension
    if (!schemaFileName.EndsWith(".proto"))
    {
        schemaFileName += ".proto";
    }

    var protoFilePath = Path.Combine(outputDirectory, schemaFileName);
    var protoDirectory = Path.GetDirectoryName(protoFilePath);

    Directory.CreateDirectory(protoDirectory!);

    await File.WriteAllTextAsync(protoFilePath, schema.SchemaString, Encoding.UTF8, cancellationToken);

    // We also need to download any schemas referenced by this schema
    // before we can compile the Protobufs
    await SaveReferencedSchemas(schema, outputDirectory, cancellationToken);
}

private async Task SaveReferencedSchemas(RegisteredSchema schema, string outputDirectory, CancellationToken cancellationToken)
{
    foreach (var reference in schema.References)
    {
        var referencedSchema = await _schemaRegistryClient.GetRegisteredSchemaAsync(reference.Subject, reference.Version);
        var referencedSchemaFileName = referencedSchema.Subject;

        if (!referencedSchemaFileName.EndsWith(".proto"))
        {
            referencedSchemaFileName += ".proto";
        }

        var referencedProtoFilePath = Path.Combine(outputDirectory, referencedSchemaFileName);
        var referencedProtoDirectory = Path.GetDirectoryName(referencedProtoFilePath);

        Directory.CreateDirectory(referencedProtoDirectory!);

        await File.WriteAllTextAsync(referencedProtoFilePath, referencedSchema.SchemaString, Encoding.UTF8, cancellationToken);

        // Recursion!
        // This will persist any referenced schemas that are referenced from this one,
        // so your root schema's grand-child and great-grand-child, etc. references are
        // included on disk for compilation.
        await SaveReferencedSchemas(referencedSchema, outputDirectory, cancellationToken);
    }
}
```

Once the protobuf files for the topic's schema (and any schemas referenced by that schema) are persisted to disk, we can compile them using the [Protoc](https://protobuf.dev/overview/) compiler.

> Note: you will need to [download the binary](https://github.com/protocolbuffers/protobuf#protobuf-compiler-installation) and include it somewhere that your program has access to execute from.

Since Protoc is an executable binary, we can launch a separate process to invoke it against the `.proto` files we downloaded above.

```csharp
async Task CompileProtobufs(string outputDirectory, CancellationToken cancellationToken)
{
    var protocFileInfo =  new FileInfo("/path/to/protoc.exe");
    var directoryInfo = new DirectoryInfo(outputDirectory);

    foreach (var protoFileInfo in directoryInfo.EnumerateFiles("*.proto", SearchOption.AllDirectories))
    {
        var processStartInfo = new ProcessStartInfo
        {
            WorkingDirectory = protocFileInfo.DirectoryName,
            FileName = protocFileInfo.FullName,
            Arguments = $"--proto_path={directoryInfo.FullName} --csharp_out={protoFileInfo.DirectoryName} {protoFileInfo.FullName}",
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        var protocProcess = Process.Start(processStartInfo);

        if (protocProcess is null)
        {
            throw new InvalidOperationException("protoc process failed to start");
        }

        await protocProcess.WaitForExitAsync(cancellationToken);

        if (protocProcess.ExitCode != 0)
        {
            var errorMessages = await protocProcess.StandardError.ReadToEndAsync(cancellationToken);
            throw new InvalidOperationException($"protoc process exited with code {protocProcess.ExitCode} - {errorMessages}"); ;
        }
    }
}
```

## Loading the Compiled Protobuf Types

What we have at this point is a directory containing `.proto` files, as well as `.cs` files which we generated from the Protobufs using Protoc.

We can now load these classes into an in-memory assembly so that we can use the compiled types in our program:

```csharp
using Google.Protobuf;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

async Task<Type[]> LoadCompiledMessageTypes(string outputDirectory, CancellationToken cancellationToken)
{
    var syntaxTrees = new List<SyntaxTree>();
    var hashes = new HashSet<string>();

    // add all the generated C# files to the compilation
    foreach (var file in Directory.EnumerateFiles(outputDirectory, "*.cs", SearchOption.AllDirectories))
    {
        var source = await File.ReadAllTextAsync(file, cancellationToken);

        // if the directory contained multiple copies of the same protobuf,
        // (e.g. if it was referenced from multiple places in the schema hierarchy)
        // we only want to add each unique .cs class to our assembly once,
        // or we'll get compilation errors due to conflicting type names
        var hash = CalculateMd5Hash(source);

        if (!hashes.Contains(hash))
        {
            syntaxTrees.Add(CSharpSyntaxTree.ParseText(
                source,
                new CSharpParseOptions(LanguageVersion.Latest),
                cancellationToken: cancellationToken));

            hashes.Add(hash);
        }
    }

    var compilation = CSharpCompilation.Create(
        $"result.dll",
        syntaxTrees,
        MetadataReferences.Value,
        new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

    using var ms = new MemoryStream();
    var result = compilation.Emit(ms);

    if (!result.Success)
    {
        var errors = result.Diagnostics.Where(x => x.Severity == DiagnosticSeverity.Error);
        var errorMessages = string.Join(Environment.NewLine, errors.Select(x => x.GetMessage()));
        throw new InvalidOperationException($"Failed to compile protobufs: {errorMessages}");
    }

    // if we've reached this point, the compilation wwas a success,
    // so get all the types in the generated assembly that are implementations
    // of the Google.Protobuf.IMessage interface
    var compiledAssembly = Assembly.Load(ms.ToArray());
    var messageTypes = compiledAssembly.GetTypes()
        .Where(x => x.IsAssignableTo(typeof(IMessage)))
        .ToArray();

    return messageTypes;
}

private static string CalculateMd5Hash(string value)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(value);

    using var md5 = System.Security.Cryptography.MD5.Create();
    var hashBytes = Encoding.UTF8.GetBytes(value);

    return Convert.ToHexString(hashBytes);
}

// A standard set of references which are required to compile the Protobuf class library
private static Lazy<MetadataReference[]> MetadataReferences => new Lazy<MetadataReference[]>(() =>
{
    var dotnetDirectory = Path.GetDirectoryName(typeof(object).GetTypeInfo().Assembly.Location)!;

    return new[]
    {
        MetadataReference.CreateFromFile(Path.Combine(dotnetDirectory, "netstandard.dll")),
        MetadataReference.CreateFromFile(Path.Combine(dotnetDirectory, "System.dll")),
        MetadataReference.CreateFromFile(Path.Combine(dotnetDirectory, "System.Collections.dll")),
        MetadataReference.CreateFromFile(Path.Combine(dotnetDirectory, "System.Linq.dll")),
        MetadataReference.CreateFromFile(Path.Combine(dotnetDirectory, "System.Runtime.dll")),
        MetadataReference.CreateFromFile(Path.Combine(dotnetDirectory, "System.Private.CoreLib.dll")),
        MetadataReference.CreateFromFile(typeof(IMessage).GetTypeInfo().Assembly.Location),
    };
});
```

Now that we've got a set of compiled C# types which represent the Protobuf schema for our Kafka topic,
we need to find the `MessageDescriptor` for the type that represents the root-level object for the topic's value:

```csharp
async Task<MessageDescriptor?> GetMessageDescriptor(RegisteredSchema schema, CancellationToken cancellationToken)
{
    var outputDirectory = "/my/temp/directory";
    
    var messageTypeName = GetMessageTypeName(schema.SchemaString);
    await SaveSchemaAndReferences(scheam, outputDirectory, cancellationToken);
    await CompileProtobufs(outputDirectory, cancellationToken);

    var messageTypes = await LoadCompiledMessageTypes(outputDirectory, cancellationToken);
    var messageType = messageTypes.FirstOrDefault(x => x.Name == messageTypeName);

    // getting the descriptor is a bit tricky, since it's a static field on the IMessage implementation
    var descriptorProperty = messageType?.GetProperty(nameof(IMessage.Descriptor), BindingFalags.Public | BindingFlags.Static);
    var messageDescriptor = descriptorProperty?.GetValue(null, Array.Empty<object>()) as MessageDescriptor;

    return messageDescriptor;
}

static string? GetMessageTypeName(string schemaString)
{
    // get the name of the first defined message in the schema
    if (Regex.Match(schemaString, @"message\s+(\w+)\s+\{") is Match match
        && match.Success && match.Groups.Count > 0)
    {
        return match.Groups[1].Value;
    }

    return null;
}
```

## Publishing Messages

Phew! Ok, now that we have a way to get the `MessageDescriptor` for our topic's schema, we should be able to
dynamically parse JSON to the Protobuf type, and from there we can actually spit some messages onto the Kafka topic.

```csharp
using Confluent.Kafka;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;
using Google.Protobuf;

async Task PublishJsonAsProtobuf(string topicName, string messageKey, string messageValueJson, CancellationToken cancellationToken)
{
    var valueSchema = await TryGetLatestSchema($"{topicName}-value");
    var messageDescriptor = await GetMessageDescriptor(valueSchema, cancellationToken);
    var messageValueProtobuf = messageDescriptor.Parser.ParseJson(messageValueJson);

    // in order to invoke the method, we need to use reflection to get the
    // generic method with the type of our message value
    var methodInfo = this.GetType()
        .GetMethod(nameof(ProduceMessageWithStringKey), BindingFlags.NonPublic | BindingFlags.Instance)
        .MakeGenericMethod(messageDescriptor.ClrType);

    // now we can invoke the generic method, which will enable us to hop across
    // the dynamic / generic divide into the typed ProduceMessageWithStringKey method below
    var task = methodInfo.Invoke(this, new[] { topicName, messageKey, messageValueProtobuf, cancellationToken }) as Task;
    await task;
}

private async Task ProduceMessageWithStringKey<TValue>(
    string topic,
    string key,
    TValue value,
    CancellationToken cancellationToken)
{
    try
    {
        // create a typed producer instance with a protobuf value serializer
        // and the schema regsitry client we configured earlier
        using var producer  = new ProducerBuilder<string, TValue>(_producerConfig)
            .SetValueSerializer(new ProtobufSerializer<TValue>(_schemaRegistryClient))
            .Build();

        var result = await producer.ProduceAsync(
            topic,
            new Message<string, TValue>
            {
                Key = key,
                Value = value
            },
            cancellationToken);
    }
    catch (KafkaException ex)
    {
        // handle the exception
    }
}
```

And there we have it! Dynamically compiled Protobuf schemas parsed from JSON and published to a schema-enabled Kafka topic.