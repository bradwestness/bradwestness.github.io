---
layout: post
title: Record Collection Equality in C#
categories: [Software,Programming,.NET]
image: content/images/record_collection.jpeg
---

I've seen this come up a few times at work, so I figured I'd dig in a bit and expound on how equality does and does not work with [C# 9 "record" types](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record) and collections.

The `record` keyword in C# is syntactic sugar for defining a class with immutable properties (read: `record` properties have [the `init` modifier](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/init)), with the added benefit that overrides for the `Object` type's `Equals()` and `GetHashCode()` methods are automatically generated, which also ensures _*by value*_ equality comparisons, rather than the _*by reference*_ comparisons you get by default when comparing `Class`-instance objects in C#.

## _By Reference_ Equality

Let's say we have a `Person` class, defined like this:

```csharp
public class Person
{
    public string FirstName { get; init; }
    public string LastName { get; init; }
}
```

Now, if we compare two instances of this class, they will return `false` even if the value of the `FirstName` and `LastName` properties are the same:

```csharp
var p1 = new Person { FirstName = "Brad", LastName = "Westness" };
var p2 = new Person { FirstName = "Brad", LastName = "Westness" };

Console.WriteLine($"Are these objects equal? {p1 == p2}.");
// Output: Are these objects equal? False.
```

The `p1` and `p2` objects are both instances of the `Person` class, but they both reference different objects in memory, therefore the equality check is false.

## _By Value_ Equality

Now, let's say we define `Person` as a `record` instead:

```csharp
public record PersonRec(string FirstName, string LastName);

var p3 = new PersonRec("Brad", "Westness");
var p4 = new PersonRec("Brad", "Westness");

Console.WriteLine($"Are these objects equal? {p3 == p4}.");
// Output: Are these objects equal? True.
```

This works as long as all the properties on the `PersonRec` type are primitives, or other `record` types.

This is because when we use the `record` keyword, the compiler generates a class that overrides the `Equals()` method to consider the equality of all the members of the object rather than just the object itself.

So, using `record` is roughly equivalent to defining a class like this:

```csharp
public class PersonRec
{
    public string FirstName { get; init; }
    public string LastName { get; init; }

    public PersonRec(string firstName, string lastName)
    {
        this.FirstName = firstName;
        this.LastName = lastName;
    }

    public override bool Equals(PersonRec other)
    {
        return this.FirstName.Equals(other.FirstName) && this.LastName.Equals(other.LastName);
    }

    // records also override the == and != operators, as well as GetHashCode(), among a few other things
}
```

Let's see what happens if we add an `Address` record to the `PersonRec` type:

```csharp
public record PersonRec(string FirstName, string LastName, AddressRec Address);
public record AddressRec(string Street, string City, string State, string PostalCode);

var p5 = new PersonRec("Brad", "Westness", new AddressRec("123 Foo Street", "Springfield", "AL", "12345"));
var p6 = new PersonRec("Brad", "Westness", new AddressRec("123 Foo Street", "Springfield", "AL", "12345"));

Console.WriteLine($"Are these objects equal? {p5 == p6}.");
// Output: Are these objects equal? True.
```

The equality check still works becuase `AddressRec` is also a `record` and overrides it's own `Equals()` method with _*by value*_ comparisons, and therefore when the two `PersonRec` objects are compared, the values of each of the properties on their `Address` property are compared _*by value*_ as well.

Let's say, however, that you need a *collection* of addresses on your person object.

```csharp
public record PersonRec(string FirstName, string LastName, IEnumerable<AddressRec> Addresses);
public record AddressRec(string Street, string City, string State, string PostalCode);

var p7 = new PersonRec("Brad", "Westness", new[] { new AddressRec("123 Foo Street", "Springfield", "AL", "12345") });
var p8 = new PersonRec("Brad", "Westness", new[] { new AddressRec("123 Foo Street", "Springfield", "AL", "12345") });

Console.WriteLine($"Are these objects equal? {p7 == p8}.");
// Output: Are these objects equal? False.
```

🚨 The two `record`s are no longer considered equal! 🚨

This is because `IEnumerable<T>` is not, itself, a record type. So, while the `FirstName`, `LastName` and `Addresses` properties are still compared to each other when comparing the two `PersonRec` instances, the `Addresses` property is simply a reference to an object (in this case an `Array`) that itself does not implement _*by value*_ equality.

The comparison of the arrays is done _*by reference*_, and they don't point to the same `Array` instance, so the equality fails.

## _SetEquals_ to the Rescue

The HashSet type (included in the BCL) includes a `SetEquals()` method, which will compare two collections of objects, and return true if they contain the same items.

So, what happens if we define the `Addresses` property as a `HashSet<AddressRec>` instead of an `IEnumerable<AddressRec>`?

```csharp
public record PersonRec(string FirstName, string LastName, HashSet<AddressRec> Addresses);
public record AddressRec(string Street, string City, string State, string PostalCode);

var p9 = new PersonRec("Brad", "Westness", new HashSet(new[] { new AddressRec("123 Foo Street", "Springfield", "AL", "12345") }));
var p10 = new PersonRec("Brad", "Westness", new HashSet(new[] { new AddressRec("123 Foo Street", "Springfield", "AL", "12345") }));

Console.WriteLine($"Are these objects equal? {p9 == p10}.");
// Output: Are these objects equal? False.
```

Wait, what? It's still false?

This is because, while `HashSet` includes the `SetEquals()` method, it doesn't use that as the default behavior for it's `Equals()` method (nor does it override the `==` operator).

If we want the two objects to be considered equal, we can extend `HashSet` to specify that `SetEquals()` is the default method of comparison.

```csharp
public class EquatableHashSet<T> : HashSet<T>
{
    public EquatableHashSet() : base() { }

    public EquatableHashSet(IEnumerable<T> collection) : base(collection) { }

    public override bool Equals(obj? obj)
    {
        if (obj is IEnumerable<T> other)
        {
            // use set equality by default when possible
            return this.SetEquals(other);
        }

        return base.Equals(obj);
    }
}
```

Now, if we use this new `EquatableHashSet` type for our `Addresses` collection, the "set equality" of each collection will be taken into consideration as part of the `PersonRec` object, and it will return true if the values on the Address objects are the same - even if they are in a different order in the collection!

```csharp
public record PersonRec(string FirstName, string LastName, EquatableHashSet<AddressRec> addresses);
public record AddressRec(string Street, string City, string State, string PostalCode);

var p11 = new PersonRec("Foo", "Bar", new EquatableHashSet<AddressRec>(new[]
{
    new Address("123 Foo Street", "Springfield", "AL", "12345"),
    new Address("456 Bar Street", "Springfield", "AL", "12345")
}));

var p12 = new PersonRec("Foo", "Bar", new EquatableHashSet<AddressRec>(new[]
{
    new Address("456 Bar Street", "Springfield", "AL", "12345"),
    new Address("123 Foo Street", "Springfield", "AL", "12345")
}));

Console.WriteLine($"Are these objects equal? {p11 == p12}.");
// Output: Are these objects equal? True.
```

The two `PersonRec` instances are now considered equivalent, because all the properites have the same values, and the two `EquatableHashSet<AddressRec>`'s set equality was true, even though the addresses are not in the same order.

### Caveat Emptor

The way we defined `EquatableHashSet<T>` above only works when the type of the object in the collection is a primitive or `record` type.

If we used a regular class instead of a `record` for the Address type, the items in the collection would still be compared _*by reference*_, unless you manually override the `Equals()` and `GetHashCode()` methods the same way that `record` does automatically.

You can constrain the generic type of the `EquatableHashSet` implementation to only allow types that implement the `IEquatable<T>` interface to obviate this problem:

```csharp
public class EquatableHashSet<T> : HashSet<T>
    where T : IEquatable<T>
{
    public EquatableHashSet()
        : base()
    {

    }

    public EquatableHashSet(IEnumerable<T> collection)
        : base(collection)
    {

    }

    public override bool Equals(object? obj)
    {
        if (obj is IEnumerable<T> other)
        {
            return this.SetEquals(other);
        }

        return base.Equals(obj);
    }
}
```

With the `where T : IEquatable<T>` constraint, the compiler will no longer allow passing in types that do not implement `IEquatable<T>`. All `record` types implement this by default, so you will be able to use them as expected, but you will not be able to use `EquatableHashSet` with any `class` types that don't implement the interface explicitly.

Doing _*by value*_ comparison of every item in a collection obviously has performance implications as well, since comparing the equality of the containing object will enumerate through the collection and compare the equality of each item, so use wisely.
