---
layout: post
title: "Introducing OBS Home Run - Turn your PC into a virtual HDTV tuner"
description: "How a stack of three media servers, infinite buffering wheels, and TV protocol arcana led to OBS HomeRun: a 14 MB virtual HDTV tuner in Rust."
categories: [Software, Home Lab, DIY, Rust, Linux]
image: content/images/introducing-obs-homerun.jpg
image_alt: "A hand holding a television remote control pointed toward a turned-on flat screen TV."
---

In my [last post](/2026/09/28/year-of-the-linux-desktop/), while talking about using local coding agents on my Bazzite desktop, I breezily mentioned getting my PC screen onto the living room TV:

> "The bigger one was getting my desktop onto the living room TV. I have an HDHomeRun attached to the antenna on my roof, which streams over-the-air TV to the smart TV, and I wanted the same thing for my desktop. It's useful for watching things that don't have good TV app support. OBS captures the screen and streams it to MediaMTX, go2rtc restreams it, and Universal Media Server serves it to the TV over DLNA."

I spoke too soon.

It worked for about forty-five seconds at a time—just long enough to verify it once, take a mental victory lap, write that paragraph, and feel triumphant. And then I actually sat down on the couch to watch something, and the wheels immediately came off.

## The Forum Graveyard

Streaming a PC desktop to a television over a local network sounds like something that should have been solved in 2012. It hasn't been. In fact, if you spend an evening digging through Reddit threads on r/obs and r/hometheater, OBS forum posts, and issues on various open-source streaming repos, you'll find a veritable graveyard of people asking the exact same question:

*How do I stream my desktop to my smart TV without installing an app on the TV?*

The replies are almost universally unhelpful:

1. *"Just buy an Apple TV and AirPlay it."* (I don't want to buy a $150 proprietary box when the TV already has an Ethernet jack, a 4K panel, and a perfectly functional hardware decoder.)
2. *"Use Moonlight and Sunshine."* (Sunshine is fantastic for low-latency game streaming, but it requires a dedicated client app on the TV. That means navigating an app store, pairing game controllers, and dealing with an interface every time you just want to toss a video on the screen.)
3. *"Sideload Kodi in developer mode on webOS or Tizen."* (Which expires every 50 days unless you run a cron job or manually re-authenticate developer sessions.)
4. *"Open the TV's built-in web browser and type `http://192.168.1.xxx:8080`."* (Typing an IP address and port with a directional pad on a television remote is an experience designed by Dante.)

Everyone on those threads wanted the exact same thing I did: I want to walk into the living room, turn on the TV, click an input or channel on the remote, and see my desktop. No apps. No sideloading. No browser address bars.

{% include figure.html 
    filename="xkcd-wisdom-of-the-ancients.png" 
    alt="Never have I felt so close to another soul and yet so helplessly alone, as when I Google an error and there's one result: a thread by someone with the same problem and no answer, last posted to in 2003. A person violently shakes a computer monitor yelling: 'Who were you, DenverCoder9? What did you see?!'" 
    description="“Wisdom of the Ancients” by Randall Munroe (xkcd.com/979), licensed under CC BY-NC 2.5." 
%}

## The House of Cards

My first attempt was the Rube Goldberg machine I confessed to in the last post: OBS streaming RTMP into [MediaMTX](https://github.com/bluenviron/mediamtx), which forwarded RTSP to [go2rtc](https://github.com/AlexxIT/go2rtc), which fed into [Universal Media Server (UMS)](https://www.universalmediaserver.com/) to serve it over DLNA.

Here is what happens when you try that in reality.

Universal Media Server—and frankly, almost every traditional media server like Plex, Jellyfin, or Serviio—is designed around [media files sitting on a disk](/2020/02/01/lack-rack-plex-nas-part-1/). When a TV connects to a DLNA server, the server advertises a media file with a known length, byte ranges, and seek capabilities. 

When you feed a media server an infinite live pipe with no end, its assumptions crumble. The server tries to perform byte-range queries to inspect the "file" size, or it attempts to buffer the stream into RAM. Within twenty seconds, one of three things happened:
- The server process panicked with a buffer overflow and died.
- The TV's player attempted to seek to the "end" of the stream and hit EOF.
- The stream played for five seconds, stuttered, and locked into an infinite spinning loading wheel.

Chaining three separate containers together just compounded the failure modes. If any hop introduced a clock drift or a dropped frame, the whole pipeline stalled. I had created a system with four network hops, three different port mappings, and 1.5 GB of container images sitting on my machine, and it couldn't play video for two consecutive minutes.

## The Prototyping Spiral

At that point, I decided to do what I talked about in [Rethinking Build vs. Rent](/2026/08/28/rethinking-build-vs-rent-in-the-era-of-coding-agents/): stop trying to force an existing monolithic tool into a role it wasn't designed for, and build the narrow capability I actually needed.

I started by asking my local coding agent to write a standalone Python script. The script spun up an SSDP multicast listener on `239.255.255.250:1900` to advertise a UPnP device, answered SOAP requests, and spawned an FFmpeg process to pipe MPEG-TS video over HTTP when requested.

That was a step forward, but Python brought its own baggage. Spawning subprocesses and piping raw video streams through Python's `asyncio` or `subprocess` loops created subtle GC pauses. More annoyingly, packaging a Python runtime with dependencies resulted in a 300+ MB container that chewed through ~80 MB of RAM while sitting idle.

Next, I ported the entire thing to Go. Go was much cleaner: a single statically compiled binary, goroutines for SSDP, and native HTTP handling. It worked, and it was reliable. But even in Go, the runtime and garbage collector held onto ~25 MB of resident memory. 

Twenty-five megabytes is not huge in the grand scheme of things, but I wanted this service to sit in the background on my machine 24 hours a day, 7 days a week. It needed to be invisible. It shouldn't be competing for cache lines or memory when I'm running games or compiling code.

## The Simplest Thing That Could Possibly Work

Ward Cunningham coined one of my favorite engineering heuristics when formulating Extreme Programming: *"What is the simplest thing that could possibly work?"*

I stepped back and looked at the hardware. On the roof of my house, I have an antenna wired into an [HDHomeRun tuner](/2020/02/01/lack-rack-plex-nas-part-1/). When my TV tunes into the local news over the air, what is actually happening under the hood?

The HDHomeRun has no hard drive. It has no transcoding GPU. It doesn't know what a media library is. It does exactly two things:
1. It sends SSDP multicast announcements saying, *"I am a digital television tuner."*
2. When a client requests a channel over HTTP (e.g., `GET /auto/v1.1`), it dumps an infinite MPEG-TS transport stream into the socket.

That's it. It doesn't send a `Content-Length`. It advertises `DLNA.ORG_OP=00`, which explicitly instructs the TV: *This is an infinite live broadcast. Do not seek. Do not ask for byte ranges. Just play what comes out of the wire.*

Once you realize that, the entire problem simplifies. You don't need a media server. You don't need a restreaming proxy. You don't need a transcode matrix. You just need an engine that behaves like a television tuner.

## Protocol Arcana

Of course, "simple in concept" and "simple to implement against twenty-year-old smart TV firmwares" are very different things. Getting modern TVs from Samsung, LG, Sony, and Roku to play that stream flawlessly required solving three specific protocol quirks:

### 1. Mid-Stream Parameter Sets (`dump_extra`)
When OBS streams via NVENC or QuickSync, it typically emits the H.264 Sequence Parameter Set (SPS) and Picture Parameter Set (PPS) headers once, right at the start of the broadcast.

If your TV tunes into the feed five minutes later, it receives video slices without parameter sets. Software players like VLC can sometimes recover, but the hardware ASIC decoders inside smart TVs will simply discard the frames and hang forever waiting for parameter headers. 

The fix was injecting FFmpeg's `dump_extra` bitstream filter:
```bash
-bsf:v "dump_extra=freq=keyframe"
```
This forces the encoder to repeat SPS and PPS metadata inline before every single IDR keyframe. The moment the TV connects, the hardware decoder locks onto the next keyframe within one second.

### 2. The ATSC Audio Standard (AC-3)
Smart TVs are picky about broadcast transport streams. While they happily play AAC audio inside an MP4 container, ATSC digital broadcast standards require Dolby Digital (AC-3) inside MPEG-TS. When fed AAC in a tuner profile, some TVs will play video silently or reject the stream outright.

By transcoding audio to AC-3 at 384 Kbps on the fly while leaving video untouched, every TV plays crystal-clear stereo or 5.1 surround sound. Converting one stereo audio stream takes less than 0.2% of a single CPU core.

### 3. Jitter Cushioning
If you stream raw live video with zero timestamp offset, the TV's hardware decode buffer sits at zero milliseconds. The first time your neighbor microwaves a burrito or your Wi-Fi experiences a 50ms latency spike, the buffer under-runs and the TV shows a buffering wheel.

Adding a modest three-second demux/decode clock cushion (`-muxdelay 3 -muxpreload 3`) gives the TV a tiny shock absorber. Playback remains completely uninterrupted even across standard home Wi-Fi.

Most importantly: **video is remuxed using stream copy (`-c:v copy`)**. No video re-encoding is performed. Zero percent GPU compute is stolen from your desktop, games, or work.

## OBS HomeRun in Rust

Once the protocol requirements were clear, I rewrote the entire daemon in Rust. 

Rust turned out to be the perfect tool for this:
- **Zero-Cost Abstractions:** Using [Tokio](https://tokio.rs/) and [Axum](https://github.com/tokio-rs/axum), the SSDP multicast listener, SOAP UPnP responders, and HTTP stream routers run entirely asynchronously with minimal resource consumption.
- **Process Supervision:** Tokio's `Command::kill_on_drop(true)` guarantees that child FFmpeg instances are terminated immediately (`SIGKILL`) the millisecond a TV disconnects or changes inputs. No zombie processes, ever.
- **Microscopic Footprint:** The compiled, stripped Rust binary is just **1.8 MB**.

I packaged the Rust binary together with [MediaMTX](https://github.com/bluenviron/mediamtx) into a single multi-arch container image (`linux/amd64` and `linux/arm64`) called **[OBS HomeRun](https://github.com/bradwestness/obs-homerun)**.

Having this in a single self-contained image is arguably the biggest operational win of the whole project. Instead of managing a brittle, Rube Goldbergian setup with three separate containers—manually piping ports from MediaMTX into go2rtc, and from go2rtc into Universal Media Server, praying none of the internal container network bridges or socket handoffs stall—everything is completely unified. The container runs MediaMTX internally as a supervised child process, exposes RTMP ingest on port 1935, handles SSDP discovery on port 1900, and serves the virtual tuner on port 5004. You pull one image, run it with host networking, and you're done.

Here is what the resource profile looks like in practice:
- **Idle (No OBS stream, No TV watching):** Consumes **~14 MB RAM** total (the Rust engine + MediaMTX combined). 0.0% CPU. 0% GPU. FFmpeg is not running at all.
- **OBS Streaming, TV Not Watching:** MediaMTX receives the RTMP feed into a lightweight socket buffer. FFmpeg is still not running—zero compute is consumed until a TV asks for it.
- **TV Actively Watching:** FFmpeg spawns on-demand, remuxes the feed with stream-copy video and AC-3 audio, and delivers it to the TV.
- **TV Turns Off:** The HTTP connection drops, FFmpeg is instantly killed, and resource consumption drops back to 14 MB.

You can run it as a Podman Quadlet on Bazzite or Fedora Silverblue:

```ini
[Unit]
Description=OBS HomeRun - Virtual HDTV Tuner
After=network-online.target

[Container]
Image=ghcr.io/bradwestness/obs-homerun:latest
ContainerName=obs-homerun
Network=host
Pull=newer
AutoUpdate=registry

[Install]
WantedBy=default.target
```

Or you can run it via Docker Compose on an always-on Synology NAS or home server:

```yaml
services:
  obs-homerun:
    image: ghcr.io/bradwestness/obs-homerun:latest
    container_name: obs-homerun
    network_mode: host
    restart: unless-stopped
```

In OBS Studio, you just set your stream server to `rtmp://localhost:1935/live` (or your NAS's IP), hit **Start Streaming**, and turn on the TV. The TV automatically discovers **OBS HomeRun** in its input or device list as Channel 1.1.

## What It Isn't

To be clear about boundaries: OBS HomeRun is not a media center. It does not record shows, it has no persistent disk buffer, and it does not support server-side pausing or rewinding. Just like an over-the-air television broadcast, it is live-only (`DLNA.ORG_OP=00`). If you want scheduled DVR recording, guide data, or commercial skipping, you should point a heavier suite like [Channels DVR](https://getchannels.com/), [Plex Live TV](https://www.plex.tv/tv/), or [Kodi](https://kodi.tv/) at its stream endpoint.

For my living room, though, it does exactly what I wanted. I hit a hotkey on my PC, grab the TV remote, and my desktop is right there on the screen.

The simplest thing that could possibly work isn't always the first thing you try. Sometimes you have to build a three-container Rube Goldberg machine first, just to understand which ninety percent of it you can throw away.

---

*The project is open source and available on GitHub: [github.com/bradwestness/obs-homerun](https://github.com/bradwestness/obs-homerun). Container images are available on GitHub Container Registry: `ghcr.io/bradwestness/obs-homerun:latest`.*
