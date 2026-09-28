---
layout: post
title: The Year of the Linux Desktop? (With Local Agents, Maybe)
description: Coding agents might finally make desktop Linux workable for people who don't want to live in man pages and forum threads, though Betteridge's Law probably still applies.
categories: [Software, AI, Home Lab, DIY]
image: content/images/year-of-the-linux-desktop.jpg
image_alt: A teenager's bedroom computer desk from the 1990s, with a beige keyboard computer and CRT monitor, a stack of gaming magazines, and a Looney Tunes pencil case, next to a wall of chocolate bar wrappers and Polish posters for The Hunchback of Notre Dame and Space Jam.
---

When I was a teenager, I'd buy issues of the now-defunct [_Maximum Linux_](https://archive.org/details/maximum-linux-magazine-2000-06) magazine and install whatever distribution came on the CD that month, usually [Mandrake](https://en.wikipedia.org/wiki/Mandriva_Linux) or something like it. This was on the family computer, to the chagrin of the rest of my family, because I often left it inoperable.

I've been interested in Linux my whole life. I've always found Linus Torvalds' story a little aspirational: a student in Helsinki [writes a whole operating system in his spare time](https://en.wikipedia.org/wiki/History_of_Linux), announces it as "just a hobby, won't be big and professional," and it ends up running most of the world's servers, not to mention [every one of the 500 fastest supercomputers](https://en.wikipedia.org/wiki/TOP500).

It never stuck for me, though. Every attempt ended at the same dead end: a peripheral I couldn't get working, or some bespoke bit of Windows-only software I needed, and I'd wind up reinstalling Windows.

People have been declaring "the year of the Linux desktop" for about as long as I've been reinstalling Windows, and [2026 has its own entry](https://www.howtogeek.com/reasons-2026-could-finally-be-the-year-of-desktop-linux/). I think coding agents might finally give it a real shot. Over the last few posts I've been [setting up a local coding agent on my Bazzite desktop](/2026/08/26/running-qwen3-coder-next-on-bazzite/), [adding a second GPU](/2026/09/07/two-gpus-and-a-bigger-context-window/), and [giving it a fast model in a sidecar](/2026/09/15/fast-model-in-a-sidecar/). Along the way I've been using that agent to set up the rest of the machine, too, and it's the first time Linux on the desktop has felt workable to me.

## The Governments Are Going First

What prompted this post was a run of news about European governments moving their own machines off Windows.

In April, France's interministerial digital agency, DINUM, [announced](https://www.numerique.gouv.fr/sinformer/espace-presse/souverainete-numerique-reduction-dependances-extra-europeennes/) it's moving its workstations from Windows to Linux, and every ministry has to have a plan for reducing its dependence on non-European technology [by this fall](https://www.it-connect.fr/la-dinum-passe-de-windows-a-linux-les-autres-ministeres-doivent-preparer-leur-plan/). DINUM itself is only about 250 machines, but it's the agency setting the direction for the rest of the French government.

The German state of Schleswig-Holstein has been at it longer. It's about [80 percent of the way](https://europioneer.io/en/blog/schleswig-holstein-blueprint-libreoffice-migration-states-municipalities-2026) through moving 30,000 workstations to LibreOffice, and its [email and calendars are already on Open-Xchange and Thunderbird](https://www.thedroptimes.com/70889/schleswig-holstein-open-source-migration). The remaining 20 percent are line-of-business applications with hard Windows or Office dependencies, like resident-registration and land-registry software. That's my teenage dead end, at the scale of a state government.

Most recently, the Dutch Interior Ministry has been building [DAWO](https://dawo.overheid-a.nl/), a government workstation [based on NixOS](https://codeberg.org/DAWO), with eight municipalities already trialing it and a first stable release expected next year. According to [It's FOSS](https://itsfoss.com/news/netherlands-dawo-initiative/), the push followed reports that U.S. sanctions cut the International Criminal Court's chief prosecutor off from his Microsoft email. The ICC is in The Hague, so that one landed close to home.

There's even [EU OS](https://eu-os.eu/), a community proof of concept for a shared public-sector distro, [built on Fedora Kinoite](https://thenewstack.io/eu-os-a-european-proposal-for-a-public-sector-linux-desktop/). That's the same atomic Fedora family my Bazzite machine comes from.

Governments have IT departments to make all this happen, though. The rest of us have forums.

## The Old Way

I still collect CDs. I like owning physical media, so I rip them on my computer and move the files into my Synology share, where they get picked up by my [Plex server](/2020/02/01/lack-rack-plex-nas-part-1/). On Windows I used something like [MediaMonkey](https://www.mediamonkey.com/) for the ripping.

On Linux, the tool I landed on is [abcde](https://abcde.einval.com/), "A Better CD Encoder," a command-line ripper configured through a `~/.abcde.conf` file. Getting it to behave the way I wanted took a lot of deep diving: the compression settings, the output filenames, the [MusicBrainz](https://musicbrainz.org/) lookups. The part that took longest was the filename munging, a set of extra settings that did exactly what I wanted and that I could only find by reading through a pile of forum posts and Super User questions.

That's the classic Linux experience when something doesn't work the way you'd like. You wind up poring over man pages, forum threads, and mailing list archives, since a lot of Linux projects are still somewhat archaically run through listservs. The config you need is often esoteric, written in some bespoke format, and saved in a seemingly arbitrary location on disk. Then you have to find documentation that applies to your particular install, given the myriad of package managers, config systems, and desktop environments out there. The answer you finally find might be for somebody else's distro.

And then there's the typing. I'm not a big fan of entering huge, case-sensitive commands that do the wrong thing if you misspell one character or use one slash instead of two.

## The New Way

Mounting my Synology shares automatically at boot is the kind of thing that would've taken me forever on my own. Mapping a network drive on Windows is pretty intuitive. On Linux, I could describe what I wanted to the Qwen agent and let it work out the rest.

The bigger one was getting my desktop onto the living room TV. I have an [HDHomeRun](https://www.silicondust.com/) attached to the antenna on my roof, which streams over-the-air TV to the smart TV, and I wanted the same thing for my desktop. It's useful for watching things that don't have good TV app support. [OBS](https://obsproject.com/) captures the screen and streams it to [MediaMTX](https://github.com/bluenviron/mediamtx), [go2rtc](https://github.com/AlexxIT/go2rtc) restreams it, and [Universal Media Server](https://www.universalmediaserver.com/) serves it to the TV over DLNA. Other than OBS, each piece is a small [quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) file in `~/.config/containers/systemd/`, the same pattern as the model servers from the first post:

```ini
[Unit]
Description=MediaMTX RTMP

[Container]
Pull=newer
Image=docker.io/bluenviron/mediamtx:latest
PublishPort=1935:1935
PublishPort=8888:8888
PublishPort=8554:8554
Environment=MTX_PROTOCOLS=tcp

[Service]
Restart=always

[Install]
WantedBy=default.target
```

None of it is complicated once it's written. But that's four pieces of software I'd never touched, each with its own ports, protocols, and config, and wiring them together by hand would've been way more trouble than it's worth.

The one that best shows how this works was my displays. I switch a KVM between my home and work PCs, and when I switched back to the Bazzite machine, the displays wouldn't wake properly. The agent walked me through a series of diagnostic commands, like `sudo nvidia-xconfig`, which I ran in a separate terminal and pasted the output back from. It worked out that I needed a couple of NVIDIA kernel parameters, which on an atomic distro like Bazzite you set through `rpm-ostree` instead of editing a bootloader config:

```bash
sudo rpm-ostree kargs --append='nvidia.NVreg_HardKeepAlive=1'
sudo rpm-ostree kargs --append='nvidia.NVreg_PreserveVideoMemoryAllocations=1'
```

That's exactly the kind of fix I'd never have found on my own: an obscure driver setting, applied through a tool specific to one family of distros.

It's also how I work with the agent on anything that needs root. I don't let it run `sudo`, and it can't do interactive authentication anyway, so it tells me the command and I run it myself. That keeps a human in the loop for anything that touches the system, the same fail-safe instinct as [the classifier falling back to manual approval](/2026/09/15/fast-model-in-a-sidecar/) in the last post.

## Betteridge's Law

[Betteridge's Law of Headlines](https://en.wikipedia.org/wiki/Betteridge%27s_law_of_headlines) says any headline ending in a question mark can be answered with "no," and I think this one still can.

The thing stopping it is the setup. My local coding agent works, but getting it working took three blog posts and a second GPU. That's pretty technical and involved, and the people who'd get the most out of a config assistant are exactly the people who aren't going to build one.

## An Agent in the Box

I could see a world in the near future where Linux distros come with an agent in the box: a small local model specifically trained for that distro, acting as its config assistant. Red Hat is already partway there. RHEL 10 ships a [command-line assistant](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/interacting_with_the_command-line_assistant_powered_by_rhel_lightspeed/introducing-rhel-lightspeed-for-rhel-systems) scoped to RHEL, and there's an [offline developer preview](https://www.redhat.com/en/blog/use-rhel-command-line-assistant-offline-new-developer-preview) that runs Phi-4-mini on the machine itself. That's aimed at enterprise servers, though. Where it'd really matter is the consumer-facing distros like Ubuntu or Linux Mint, and the sidecar from the last post runs in about 5 GB of VRAM.

If the Mandrake CD had come with one of those, the family computer might've survived.
