---
layout: post
title: Assigning a Fixed IP Address to a NIC Team in Windows Server
categories: [Software,Programming]
image: content/images/windows-server-manager-nic-team.png
---

Ever since setting up a [Lack Rack Plex NAS](/2020/02/01/lack-rack-plex-nas-part-1/) a few years ago (which I have since upgraded to a "real" rack),
I've had trouble with the fixed IP address I assigned to the server in [my Unifi network setup](/2020/08/08/switching-to-unifi/).

I had configured a fixed IP in my Unifi admin console, which *should* result in the server always getting assigned the same IP address after every restart.

{% include figure.html filename="unifi-nic-team-fixed-ip.png" description="Assigning a Fixed IP address in the Unifi Network console" %}

I also set up a port forwarding rule (or port forward) so that incoming Plex traffic to my network would be forwarded to my Plex server.

{% include figure.html filename="unifi-nic-team-port-forward.png" description="Creating a port forwarding rule in the Unifi Network console" %}

However, whenever my server would reboot (after installing Windows Server updates, usually) - Plex would stop being accessible from outside my home network. The server would be assigned an IP address that was not the fixed IP I had configured. I couldn't figure this out for the longest time, so I would just go into the Unifi console and update the port forwarding rule to point to the new IP my server had been assigned (this wasn't *that* frequent).

However, after a lot of trial and error, I finally figured out and resolve this issue. The problem was due to the fact that I have my Plex server (a used Dell PowerEdge R710 I bought on eBay) - set up to use an LACP-enabled NIC Team.

## The Solution

So, when you have a NIC Team configured in Windows Server, it turns out that the MAC Address of the "virtual NIC" that Windows Server creates (which really distributes traffic across the physical NICs that are members of the team) doesn't get assigned a MAC address.

{% include figure.html filename="windows-server-device-manager-nic-team.png" description="Virtual and Physical NICs in Device Manager" %}

By default, Windows Server just picks the MAC address of one of the NIC Team's member NICs on startup as the MAC address for the team.

However, the really tricky bit is that this is done in a non-deterministic fashion. You might reasonably expect that Windows Server would always pick the NIC in the first PCI slot (or some other physical attribute)as the NIC to use as the MAC address for the virtual adapter. That way, when you assign a fixed IP to the virtual adapter, it would work every time.

This isn't the case. It just picks one seemingly at random, so your fixed IP will be assigned to the NIC team if it happens to pick the MAC address that is associated to the fixed IP, but that's a one-in-four shot in the case of my server.

{% include figure.html filename="windows-server-nic-team-properties.png" description="By default, the NIC Team's virtual adapter MAC Address is 'Not Present'" %}

To address this, you can edit the MAC address of the NIC Team's virtual adapter, and just assign it a made-up, fake MAC address (just make sure it's unique on your network).

{% include figure.html filename="duck-duck-go-mac-address-generator.png" description="DuckDuckGo to the rescue!" %}

If you [search for 'MAC address generator' in DuckDuckGo](https://duckduckgo.com/?q=mac+address+generator) (my search engine of choice), it'll spit out a random MAC address. Just copy and paste that into the "Value" box in the adapter driver's properties window as shown above (you'll need to remove any colons first).

{% include figure.html filename="windows-server-nic-team-properties-with-mac-address.png" description="Note: you have to remove the colons from the MAC Address before entering it into this input." %}

Now, if you go create a fixed IP address to the new device on your router (after deleting the old assignment to a physical NIC's MAC address, natch), it should actually get assigned to your virtual NIC team every time, no matter which NIC is chosen as the "primary" member of the NIC team after a reboot.

{% include figure.html filename="nic-team-plex-remote-access.png" description="My server is actually using the fixed IP address I assigned to it, wow!" %}

Victory!

