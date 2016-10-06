---
layout: post
title: Introducing Mod 5 - A Table Tennis Game
---

Mod 5 is a game for 3 or more people that can be played using standard
table tennis  equipment. It is a variant of
[Cutthroat](https://www.youtube.com/watch?v=OlJOICX_B7M), but with different scoring.

## The Game ##
In Cutthroat, each player makes a shot and then rotates to the opposite side
of the table. If you miss a shot, you get a point, and the first player to reach
five points is eliminated. The last player standing wins. Points are "bad" and you
want your score to remain as low as possible.

The problem with this is that it encourages conservative play because missing a shot
is punished. It also enables you to tee up big softballs to the player opposite you
in order to get the person behind you out, rather than actually earning the victory
for yourself.

In Mod 5, instead of getting a "bad" point when you miss a shot, you get a "good" point
when you force someone else to miss. So whenever a player misses, the person who made
the previous shot gets a point. So the object of the game is to make shots that are hard
to return, as you are rewarded for making other people miss.

Here's where the "mod 5" bit comes in - every time a player reaches a multiple of 5,
the player(s) with the lowest score(s) are eliminated. So if one player reaches five and the
others have 3, 2, 1, and 0, the player with 0 is eliminated. The next time someone reaches 5
the next lowest score is eliminated, and so on. Players cannot eliminate themselves.

Whenever a player misses a shot, they must restart the action by serving. If they miss their serve,
they *lose a point*, and can go negative. However, each player can only hit a given "mod 5" score
milestone once; e.g. if a player reaches 5 and the lowest score is eliminated, they cannot intentionally
miss a serve to go back to 4 and then hit 5 again and eliminate more players. The low score is only
eliminated the first time they reached 5 points.

Once there are only two players remaining, the players stop rotating and take turns serving
the ball until someone reaches the next multiple of five above the current high score. So if two players remain and one has
six and one has three, they play to 10 and the first person who reaches 10 wins.

## The Name ##
The game gets its name from the [modulo operator](https://en.wikipedia.org/wiki/Modulo_operation) in
computer programming, which is used to calculate whether one number is divisible by another.
```javascript
function isDivisibleByFive(number) {
    return number % 5 === 0;
} 
```
So whenever a player reaches a score that would result in zero if "mod five" was applied, people get
eliminated.