---
layout: post
title: Of Daylight and Savings
categories: [Software,Programming,.NET]
image: content/images/dali.png
---

The "right" way to persist and transmit dates and times seems like it should be a solved problem, yet ask any three software engineers how it should be done, and you'll get three separate answers.

There's an old axiom that goes like this:

> There are only two hard things in Computer Science: cache invalidation and naming things.
> 
> *-- Phil Karlton*

I would add to that a third hard thing, which is: planning events that span across daylight savings boundaries.

Some areas have gotten rid of daylight savings already, or are in the process of doing so, but as of this writing, it's still observed most of the contiguous US.

The worst part about working on logistics software is that every time the DST changeover happens, you get to discover what new bugs have been implemented related to DST handling since the last time it changed.

## Exercise - Running an Airline

Let's say, for example, you are operating an airline. You have a direct flight from ORD to PHX at `6:00 AM` Chicago time, every day of the year. The flight takes 4 hours.

Most developers at this point will think something along the lines of:

1. ORD is in Chicago, which is UTC-6
2. PHX is in Phoenix, which is UTC-7
2. Dates should always be stored in UTC, therefore:
3. Plan a flight for every day of the year that departs at 12:00 UTC (since `12:00 - 6:00 = 6:00 AM` in Chicago) and has an expected arrival time of 16:00 UTC (since `12 + 4 = 16`)

> Normally you might store the dates as [Unix Epoch timestamps](https://en.wikipedia.org/wiki/Unix_time), but I'm using [ISO-8601](https://en.wikipedia.org/wiki/ISO_8601) format here for human-readability.

So, you might end up with a data object that looks something like this:

```
Flights: [
    {
        id: 1,
        Departure: {
            Location: "ORD",
            Time: "2023-03-11T12:00:00.000Z"
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-03-11T16:00:00.000Z"
        }
    },
    // ...etc
]
```

There are a host of ways this can and will go wrong when Daylight Savings time changes, a few of which I'll outline here. These are all issues I've seen occur in production systems.

### Bug 1: Using Hardcoded Offsets

Now, on the front-end you need to display these dates in the local time of the airport (NOT the local time of the user who is viewing the information).

At this point, a lot of developers will say "I'll just make a lookup table of all the locations to their UTC offsets," `{ "ORD": -6, "PHX": -7, ...etc }`. Then they apply the offset to the UTC time and everything is hunky dory.

That is, until the very next following day (I used March 11th in the example on purpose). Daylight Savings Time begins in the US on March 12th, 2023, so Chicago will no longer be in `Central Standard Time` (-6), but will "spring ahead" to `Central Daylight Time` (-5).

The result is some engineer getting woken up in the middle of the night by someone frantically wondering why all the flights after March 11th are off by an hour.

> Note: a lot of developers also make the mistake of assuming that UTC offsets are always in integer amounts, which [is not the case](https://en.wikipedia.org/wiki/Time_in_Nepal).

### Bug 2: Using System.TimeZone Names

You might read the above section and think "Hah! That foolish developer, they should've simply included the timezone in the record, then they can translate it instead of depending on a hardcoded list of offsets."

If you're a .NET engineer like myself, you might use the [System.TimeZone](https://learn.microsoft.com/en-us/dotnet/api/system.timezone?view=net-7.0) names.

Now, System.TimeZone has been deprecated since the move to .NET Core, for a myriad of reasons. For one thing, *it doesn't include any Daylight Time zones*.

It has `Central Standard Time` and `Eastern Standard Time` but no `Central Daylight Time` or `Eastern Daylight Time`.

So this is another source of bugs around DST changeovers, because there's no way to effectively communicate whether DST is in effect when using this scheme.

```
Flights: [
    {
        id: 1,
        Departure: {
            Location: "ORD",
            Time: "2023-03-11T12:00:00.000Z",
            TimeZone: "Central Standard Time"
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-03-11T16:00:00.000Z",
            TimeZone: "Mountain Standard Time"
        }
    },
    {
        id: 2,
        Departure: {
            Location: "ORD",
            Time: "2023-03-12T12:00:00.000Z",
            TimeZone: "Central Standard Time"
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-03-12T16:00:00.000Z",
            TimeZone: "Mountain Standard Time"
        }
    },
    // ...
]
```

You end up with misleading data - any events planned between March 12 and November 5, 2023 will not actually be in `Central Standard Time,` so if you apply the `Central Standard Time` offset (-6) to the UTC date you'll wind up with the wrong local time, since the local time is actually `Central Daylight Time` (-5).

Therefore every consumer of this data needs to know that `Central Standard Time` really means "either CST or CDT depending on whether Daylight Savings is in effect, which you must determine for yourself," which as you may imagine is not exactly a "pit of success."

### Bug 3: Persisting UTC Offsets

So you might think "Okay, we'll just send the UTC offset of the locations instead of the timezone name." This way we can send a different offset for the dates that are during Daylight Savings and the ones that aren't:

```
Flights: [
    {
        id: 1,
        Departure: {
            Location: "ORD",
            Time: "2023-03-11T12:00:00.000Z",
            Offset: -6
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-03-11T16:00:00.000Z",
            Offset: -7
        }
    },
    {
        id: 2,
        Departure: {
            Location: "ORD",
            Time: "2023-03-12T12:00:00.000Z",
            Offset: -5
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-03-12T16:00:00.000Z",
            Offset: -7
        }
    },
    // ...
]
```

Phoenix is in Arizona, which doesn't observe Daylight Savings Time, so it's offset doesn't change. Chicago's does, and we now see it's set to -5 for the flight on the day when DST goes into effect. Looks good, right?

Well, the offsets are correct, but you may notice something - that the flight on the 5th is still going to be wrong. When you apply the -5 offset to the 12:00 UTC time, you get 7 AM, but the flight is always supposed to leave at 6 AM local time. So, we're right back where we started.

> Note: Once again, notice that using whole numbers for the offset will break down as soon as you go international and have to contend with places that have UTC offsets on the half or quarter-hour.

### Bug 4: Trying to Adjust for DST Downstream

What a lot of engineers will do at this point is go "Ah, ok, so I need to add an extra hour to the time on the front end, when it's in a location that observes DST to account for the offset changing."

So they implement some complicated logic to determine whether DST is in effect in the specified location and add or subtract an extra hour from the UTC time to account for it.

The thought process is something like:

```
12:00 UTC
-6:00 (Central Standard Time offset)
-----
 6:00 Central Standard Time, which is
 7:00 Central Daylight Time
-1:00 (extra magical adjustment hour when DST is in effect)
-----
 6:00 Central Daylight Time
```

Huzzah! The answer is what we expected! Simple as, right?

But wait: 6:00 AM in Chicago during daylight time is not actually 12:00 UTC, because `6 + 5 != 12`.

> This is the fun part, when you're on an emergency conference call with ten other engineers across the organization plus outside vendors, and everyone's doing napkin math to double check whether or not `12 - 6` has the same difference as `12 - 5`.

So, if you use this method and leave at 6:00 AM local time, you will not actually be leaving that the time the flight is scheduled for.

The extra magic adjustment hour you subtracted means you actually left at 11:00 UTC, which means that the FAA and air traffic control may have a lot of questions about why you're trying to take off an hour earlier than your scheduled time.

## So what's the right solution?

Well, there's no one "right" solution, but the main thing to remember -- the thing that a lot of people seem to trip over -- is that *you can't correct for DST changes by keeping the UTC time the same and fiddling with offsets.*

If you want an event at 6 AM during daylight time to still be at 6 AM after daylight time ends, you have to actually *plan the UTC time an hour later* to account for the DST change.

```
2023-11-04 11:00:00 UTC
           -5:00:00 CDT offset
           --------
           06:00:00 CDT
           
2023-11-05 12:00:00 UTC
           -6:00:00 CST offset
           --------
           06:00:00 CST
```

It may seem counter-intuitive since [UTC does not observe Daylight Savings](https://en.wikipedia.org/wiki/Coordinated_Universal_Time), but if the locale that the event is actually happening *does*, you need to account for that when setting the corresponding UTC time. You can't "adjust" your way out of the UTC time not changing when the locale's offset does change.

{% include figure.html filename="rufus.gif" description="Animated GIF from BILL & TED'S EXCELLENT ADVENTURE (1989) showing Rufus (George Carlin) saying 'You have to dial one number higher.'" %}

> "Listen to this dude Rufus, he knows what he's doing."
>
> *-- Bill S. Preston, Esq.*

## Extra Credit: Don't Get Caught in the Lurch when DST Becomes Permanent

Confusingly, most of the year is already spent in "daylight savings time" (March to November, so about 9 months), while only 3 months of the year are "standard time."

The [Sunshine Protection Act](https://www.reuters.com/world/us/us-senate-approves-bill-that-would-make-daylight-savings-time-permanent-2023-2022-03-15/) proposes to make DST permanent, so for our example, Chicago's UTC offset would always be -5 and no longer change to -6 over the winter months.

This can also be problematic if you persist your dates as UTC times with a specified local offset but no other contextual data, like this:

```
{
  events: [
    { id: 1, time: "2023-11-04T11:00:00.000Z", offset: -5 },
    { id: 2, time: "2023-11-05T12:00:00.000Z", offset: -6 },
  ]
}
```

Now, lets say DST is made permanent before these events actually happen. How do you handle this in your data?

Do you update all your records to subtract an hour from every UTC date that takes place between Nov 5th and March 12th and change the offset? What about parts of the country that don't observe DST already, like Arizona and bits of Indiana?

Seems like it could potentially cause a lot of problems.

My preferred method is not to persist the UTC offset, but instead persist the [TZDB identifier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) of the location:

```
{
  events: [
    { id: 1, time: "2023-11-06T11:00:00.000Z", tzdb: "America/Chicago" },
    { id: 2, time: "2023-11-06T12:00:00.000Z", tzdb: "America/Chicago" },
  ]
}
```

This way, you can rely on a robust library like [NodaTime](https://nodatime.org/) to apply the correct offset for the specified zone to the UTC time, depending on the rules of the locale where it takes place.

As long as the library you rely on is actively maintained and incorporates any changes to rules (such as the Sunshine Protection Act going into effect), you won't have to worry about updating records with new offsets. Just remember to update your NuGet package references.

You will still have to change the UTC times of future events that are currently during Standard Time, if you want them to resolve to the same local time when DST is made permanent, however.

But, it should be a lot more foolproof to know that you need to adjust the events whose TZDB is "America/Chicago" (or any of the other locales no longer observing DST), than it would be if you were just going off of records with an offset of -6.

### Extra, Extra Credit

Daylight Savings changeovers also lead to weirdness due to the fact that on days when the locale "springs ahead," there are only 23 hours in the day (there is no 2-3 AM hour, since it was skipped over), and on days when the locale "falls back," there are 25 hours, and the 1-2 AM hour happens twice.

This obviously leads to weirdness when you want something to happen once a day the time that was skipped over or repeated.

On days when we "spring ahead" should the event not happen at all, or an hour late? On days when we "fall back" should it happen twice?

This is left as an exercise for the reader.