---
layout: post
title: Syncing Your Music Library with Resilio
categories: [Software, Music]
image: content/images/groove-music-windows-10-mobile.jpg
---

I'm a little bit of a luddite when it comes to my media library. I still
buy all my music on compact disc, and rip them into my MP3 library myself
using Exact Audio copy.

This presents the problem of how to get your music library onto your mobile
device so you can, you know, actually *listen* to it. Novel.

## Windows

I was a Windows Phone 8 / Windows 10 Mobile guy until Microsoft effectively
killed the platform. There, the ecosystem was pretty thoughtful and comported
well with how I wanted to manage my media library. You simply back up your
music into OneDrive (specifically in the "Music" folder), and then the Groove
music app automagially populates your library.

![Groove Music app on Windows 10 Mobile](/content/images/groove-music-windows-10-mobile.jpg)

The nice thing about this setup is that you didn't really have to do any work
to get your music library onto your mobile device, just log into the Groove
app with the same Microsoft account you use to backup your music into OneDrive
and you're good to go. If you wanted to download some music so that you could
play it while your device was offline or not in Wifi (to avoid cellular data usage),
you could do that by song, album, or artist.

## Android

After Microsoft killed Windows 10 Mobile, I moved over to the Android ecosystem (I highly
recommend running a device in the Pixel family if you're going to do this, since nothing
else receives security updates in a sane way). Microsoft still had my back here, since
they released an effectively identical Groove app for Android which worked the same,
pulling in all the music I have in OneDrive and letting me keep things offline if I wish.

![Groove Music app on Android and iPhone](/content/images/groove-explore-android-iphone-hero.jpg)

## Groove is in the Heart

Sadly, [Microsoft announced in May of this year](https://support.microsoft.com/en-us/help/4046109/groove-music-and-spotify-faq)
that they were also discontinuing the Android and iOS Groove Music apps. Which is pretty lame.

It kind of removes a big piece of the value proposition for using OneDrive for my cloud
backup solution. However, OneDrive is still the cheapest per-gigabyte of the major
backup providers, and comes included with an Office365 subscription, so I think it's still
a good deal even with the frustrating discontinuation of the Groove music app.

## Syncing Without Groove

So now the problem is coming up with a convenient way to keep my media library up-to-date
on my phone without being able to rely on the OneDrive/Groove solution. 

There are a couple alternatives:

### Manually Sync Media

This is time consuming and annoying, any time you rip a new album into your media library,
you have to remember to also hook your phone up to your computer (after finding the appropriate cable),
and drag the music across into the right folder in File Explorer. If you have an iOS device, I
believe you actually have to run iTunes to do this too, which is a huge bloated beast of software
that I'd rather not run if I don't absolutely have to.

### Use 3rd Party OneDrive App

There are a couple third party music apps available that can read your music out of OneDrive.
I actually paid for the "pro" version of [CloudPlayer](https://play.google.com/store/apps/details?id=com.doubleTwist.cloudPlayer&hl=en),
however I found it to be pretty buggy and unstable when attempting to sync my large-ish collection.

![CloudPlayer app on Android](/content/images/cloud-player.png)

Another option is to use [Google Play Music Manager](https://support.google.com/googleplaymusic/answer/1075570?hl=en)
to sync my media collection up to the Google cloud, and then use the Google Play Music app to play the
music back on my phone. This approach has a couple dealbreaker aspects for me:

![Google Play Music Manager app on Windows](/content/images/Google-Play-Music-Manager-608x390.jpg)

1. The "matching" system that Google Music uses means that even though you own the albums and are syncing your personal MP3s, you can only actually listen to music that Google has licensed via the Google Play store
2. The Google Play Music app is mostly a front-end for purchasing music. There is an option to show "downloaded only" music, but when you do that you get an omnipresent banner throughout the app pestering you to disable it and buttons everywhere trying to get you to buy things through the Google Play store
3. The Google Play Music Manager app for Windows is pretty clearly an abandoned afterthought which looks like it hasn't been updated since the Windows XP era, and is pretty flaky

## Enter Resilio

The best solution I've found is an app called [Resilio Sync](https://www.resilio.com/). It syncs your private data over the BitTorrent network, so there's no dedicated servers, which means it's free!

There are two components:

1. The desktop app, where you create your "shares"
2. The mobile app, where you scan a QR code to sync your shares

### Step 1 - Add a Share

On the desktop app, hit the big plus-sign in the upper left of the main Resilio window to create a new share. "Standard folder" works fine for this.

![Resilio Setup - add standard share](/content/images/resilio-setup-1.png)

Select the folder where your music files are stored (for me this is the OneDrive "Music" folder).

You are then prompted to configure some options for the new share. "Read Only" should work fine as we want the desktop to be the "owner" of this share,
while the mobile device will just be a subscriber.

### Step 2 - Configure the Mobile App

On your mobile devic, launch the Resilio app (listed as just "Sync" on Android). Before subscribing to the share we created, we need to set a few options.

Hit the hamburger menu in the upper left and go to "Settings".

Under General, I turned on Auto-start, Battery saver and Auto-sleep all on.

![Resilio Setup - General Settings](/content/images/resilio-settings-general.png)

Under Network, I turned "Use mobile data" off, so Resilio will only sync my files while in Wifi to avoid incurring a ton of cellular data usage.

![Resilio Setup - Network Settings](/content/images/resilio-settings-network.png)

Under Advanced, and this is the really important part, I set my "Default folder location" and "File download location" both to the default music folder, /storage/emulated/0/Music. This means that the music files I sync via Resilio should automatically show up in other media player apps since they're in the default system location for music. 

I turned off "Autoupdate Gallery," if you leave this on and you have image files in your media library (for album art),
it will cause every folder in your media library to show up as if it's a photo folder, which can be annoying in e.g. Instagram when trying to find a photo
and you see 500 folders for every album in your media library.

![Resilio Setup - Advanced Settings](/content/images/resilio-settings-advanced.png)

### Step 3 - Subscribe to the Share

I did this by scanning the QR code from the desktop app. Then you just have to sit back and let the initial sync do it's thing. A nice feature is that you
can check the sync status either from your mobile device *or* from the desktop Resilio app.

After the share is added to your device, hit the little "i" button and turn off "Selective Sync" for the share. This makes it so new folders will be synced automatically.

### Step 4 - Play your Music!

So far I've been happiest just using [VLC for Android](https://play.google.com/store/apps/details?id=org.videolan.vlc&hl=en_GB) to play my media files. It should pick up your files automatially and display all your album art and everything. Now whenever you add new MP3s to your media folder on your desktop
(I always rip my albums directly to the OneDrive music folder using [Exact Audio Copy](http://exactaudiocopy.de/)), they'll automatically sync down to your mobile device when you're on
wifi.

![VLC for Android - Library](/content/images/vlc-app-library.png)

![VLC for Android - Now Playing](/content/images/vlc-app-now-playing.png)

Happy listening!