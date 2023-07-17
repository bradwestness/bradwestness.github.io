---
layout: post
title: Of Daylight and Savings
categories: [Software,Programming,.NET]
image: content/images/dali.png
---

The "right" way to persist and transmit dates and times seems like it should be a solved problem, yet get any three softare engineers how it should be done, and you'll get three separate answers.

There's an old axiom that goes like this:

> There are only two hard things in Computer Science: cache invalidation and naming things.
> 
> -- Phil Karlton

I would add to that a third hard thing, which is: planning events that span across daylight savings boundaries.

Some areas have gotten rid of daylight savings already, or are in the process of doing so, but as of this writing, it's still observed most of the contiguous US.

The worst part about working on logistics software is that every time the DST changeover happens, you get to discover what new bugs have been implemented related to DST handling since the last time it changed.

## Exercise - Running an Airline

Let's say, for example, you are operating an airline. You have a direct flight from ORD to PHX at `6:00 AM` Chicago time, every day of the year. The flight takes 4 hours.

Most developers at this point will think something along the lines of:

1. ORD is in Chicago, which is UTC-5
2. PHX is in Phoenix, which is UTC-7
2. Dates should always be stored in UTC, therefore:
3. Plan a flight for every day of the year that departs at 11:00 UTC (since `11:00 - 5:00 = 6:00 AM` in Chicago) and arrives at 15:00 UTC (since `11 + 4 = 15`)

So, you might end up with a data object that looks something like this:

```
Flights: [
    {
        id: 1,
        Departure: {
            Location: "ORD",
            Time: "2023-11-04T11:00:00.000Z"
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-11-04T15:00:00.000Z"
        }
    },
    // ...etc
]
```

### Bug 1 - Using Hardcoded Offsets

Now, on the front-end you need to display these dates in the local time of the location (NOT the local time of the user who is viewing the information).

At this point, a lot of developers will say "I'll just make a lookup table of all the locations to their UTC offsets," `{ "ORD": -6, "PHX": -7, ...etc }`. Then they apply the offset to the UTC time and everything is hunky dory. 

That is, until the very next following day (I used November 4th in the example on purpose). Daylight Savings Time ends in the US on November 5th, 2023, so Chicago will no longer be in Central Daylight Time (-5), but will "fall back" to Central Standard Time (-6).

The result is some engineer getting woken up in the middle of the night by someone frantically wondering why all the flights after November 5th say they're leaving at 5 AM.

### Bug 2 - Using System.TimeZone Names

You might read the above section and think "Hah! That foolish developer, they should've simply included the timezone in the record, then they can translate it instead of depending on a hardcoded list of offsets."

If you're a .NET engineer like myself, you might use the [System.TimeZone](https://learn.microsoft.com/en-us/dotnet/api/system.timezone?view=net-7.0) names, like this:

```
Flights: [
    {
        id: 1,
        Departure: {
            Location: "ORD",
            Time: "2023-11-04T11:00:00.000Z",
            Timezone: "Central Standard Time"
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-11-04T15:00:00.000Z",
            Timezone: "Mountain Standard Time"
        }
    },
    {
        id: 2,
        Departure: {
            Location: "ORD",
            Time: "2023-11-05T11:00:00.000Z",
            Timezone: "Central Standard Time"
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-11-05T15:00:00.000Z",
            Timezone: "Mountain Standard Time"
        }
    },
    // ...
]
```

Now, System.TimeZone has been deprecated since the move to .NET Core, for a myriad of reasons. For one thing, *it doesn't include any Daylight Time zones*.

It has `Central Standard Time` and `Eastern Standard Time` but no `Central Daylight Time` or `Eastern Daylight Time`. So this is another source of bugs around DST changeovers, because there's no way to effectively communicate the fact that DST is in effect when using this scheme. 

You end up with misleading data - any events planned between March 12 and November 5, 2023 will not actually be in `Central Standard Time,` so if you apply the `Central Standard Time` offset (-6) to the UTC date you'll wind up with the wrong local time, since the local time is actually `Central Daylight Time` (-5).

### Bug 3 - Specifying UTC Offsets

So you might think "Okay, we'll just send the UTC offset of the locations instead of the timezone name." This way we can send a different offset for the dates that are during Daylight Savings and the ones that aren't:

```
Flights: [
    {
        id: 1,
        Departure: {
            Location: "ORD",
            Time: "2023-11-04T11:00:00.000Z",
            Offset: -5
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-11-04T15:00:00.000Z",
            Offset: -7
        }
    },
    {
        id: 2,
        Departure: {
            Location: "ORD",
            Time: "2023-11-05T11:00:00.000Z",
            Offset: -6
        },
        Arrival: {
            Location: "PHX",
            Time: "2023-11-05T15:00:00.000Z",
            Offset: -7
        }
    },
    // ...
]
```

Phoenix is in Arizona, which doesn't observe Daylight Savings Time, so it's offset doesn't change. Chicago's does, and we now see it's set to -6 for the flight on the day when DST is no longer in effect. Looks good, right?

Well, the offsets are correct, but you may notice something - that the flight on the 5th is still going to be wrong. When you apply the -6 offset to the 11:00 UTC time, you get 5 AM, but the flight is always supposed to leave at 6 AM local time. So, we're right back where we started.

### Bug 4 - Trying to Adjust for DST on the client

What a lot of engineers will do at this point is go "ah, ok, so I need to add an extra hour to the time when it's in a location that observes DST to account for the offset changing."

So they implement some complicated logic to determine whether DST is in effect in the specified location and add or subtract an extra hour from the UTC time to account for it. So they go:

```
11:00 UTC
-6:00 (central standard time offset)
+1:00 (extra magical DST adjustment hour)
-----
 6:00 AM Chicago time
```

Huzzah! The answer is what we expected! Simple as, right? But wait - 6:00 AM in Chicago during standard time (e.g. the winter, when the UTC offset is -6), is not actually 11:00 UTC, because `6 + 6 != 11`. So if you use this method and leave at 6:00 AM local time, you will not actually be leaving that the time the flight is scheduled for.

The extra magic adjustment hour you subtracted means you actaully left at 12:00 UTC, which means that after flying for four hours, you will not arrive at 15:00 UTC but at 16:00 UTC, and everyone at the airport in Phoenix will be very confused as to why the flight that's meant to arrive at 9:00 AM is a full hour late.

## So what's the right solution?

Well, there's no one "right" solution, but the main thing to remember is that you can't correct for DST changes by keeping the UTC time the same and fiddling with offsets, you have to actually *plan the UTC times an hour later* to account for the DST change, if you want the event to be at the same local time both before and after the change.

```
2023-11-04 11:00:00 UTC
           -5:00:00 CST offset
           --------
           06:00:00 CST
           
2023-11-05 12:00:00 UTC
           -6:00:00 CST offset
           --------
           06:00:00 CST
```

Just remember the sage words of Bill S. Preston, Esquire: "Listen to this dude Rufus, he knows what he's doing."

{% include figure.html filename="rufus.gif" description="Animated GIF from BILL & TED'S EXCELLENT ADVENTURE (1989) showing Rufus (George Carlin) saying 'You have to dial one number higher.'" %}


## Extra Credit: Don't get caught with your pants down when DST goes away

As mentioned above, there's legislation in motion to end DST in the entire US - or rather, to make it permanent.

Confusingly, most of the year is already spent in "daylight savings time" (March to November, so about 9 months), while only 3 months of the year are "standard time." The [Sunshine Protection Act](https://www.reuters.com/world/us/us-senate-approves-bill-that-would-make-daylight-savings-time-permanent-2023-2022-03-15/) proposes to make DST permanent, so for our example, Chicago's UTC offset would always be -6 and no longer change to -5 over the winter months.

This can also be problematic if you persist your dates as UTC times with a specified local offset, like this:

```
{
  events: [
    { id: 1, time: "2023-11-06T12:00:00.000Z", offset: -6 },
    { id: 2, time: "2023-11-06T13:00:00.000Z", offset: -5 },
  ]
}
```

Now, lets say DST is made permanent before this event actually happens. How do you handle this in your data? 

Do you subtract an hour from every UTC date that takes place between Nov 5th and March 12th and change the offset? That seems like it could potentially cause a lot of problems, what about parts of the country that don't obvserve DST already, like Arizona and bits of Indiana?

My preferred method is to not persist the UTC offset, but instead persist the [TZDB identifier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) of the location:

```
{
  events: [
    { id: 1, time: "2023-11-06T12:00:00.000Z", tzdb: "America/Chicago" },
    { id: 2, time: "2023-11-06T13:00:00.000Z", tzdb: "America/Chicago" },
  ]
}
```

This way, you can rely on a robust library like [NodaTime](https://nodatime.org/) to apply the correct offset for the specified zone to the UTC time, depending on the rules of the locale where it takes place.

As long as the library you rely on is actively maintained and incorporates any changes to rules (such as the Sunshine Protection Act going into effect), you won't have to worry about updating records with new offsets. Just remember to update your NuGet package references.

You will still have to change the UTC times of future events that are currently during Standard Time, if you want them to resolve to the same local time when DST is made permanent, however.

### Extra, Extra Credit

Daylight Savings changeovers also lead to weirdness due to the fact that on days when the locale "springs ahead," there are only 23 hours in the day (there is no 2:30 AM since it was skipped over), and on days when the locale "falls back," there are 25 hours, and 1:30 AM happens twice.

This obviously leads to weirdness when you want something to happen once a day at the same time every day.

On days when we "spring ahead" should it not happen at all? On days when we "fall back" should it happen twice?