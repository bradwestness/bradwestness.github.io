---
layout: post
title: Creating a Smart 'On Air' Light with Home Assistant
categories: [Software, Programming]
image: content/images/on_air_light_header.jpg
---

I've been working from home full time since the start of the pandemic (before that I was working from home two days a week for about a decade). Personally, I love not having to commute to go sit at a different chair, and the flexibility this gives me to let the dog out, throw in a load of laundry over my lunch break, and pick up and drop off my kids from school.

However, when my kids are home from school (say, during spring break), they often attempt to come into the spare bedroom that serves as my office, because it's also their playroom and has a bunch of toy bins in it. This is a familiar scene: I'll be on a video call attempting to pay attention to something someone on the call is saying, when the door begins creaking open, and someone timidly peeks their head in and asks if I'm on a call (I usually am if I have the door closed).

It'd be nice if I had a way I could indicate whether or not I was on a call outside the office room I'm in so they can tell without needing to open the door. 

## Option 1: Switch-based

There are a lot of options available for these sorts of "on air" lights that recording studios use. However, there don't really seem to be any "smart" options.

{% include figure.html filename="on_air_light_screenshot_1.png" description="DuckDuckGo shopping results for 'on air light'" %}

Some come with remotes, but I think going with a manual remote or switch based option would mean I would just constantly forget to turn it on. I would be nice if it just came on automatically whenever I'm on a call.

## Option 2: Calendar-based

I found a [few articles](https://joellemaslak.medium.com/making-a-linux-based-on-air-light-for-my-home-office-w-camera-google-calendar-integration-3e5ed35e8c8) for creating an indicator light based off calendar events, however that also seems fairly unreliable to me; if you're in an ad-hoc meeting that doesn't have a corresponding calendar invite it's not going to light up.

This method also seems fairly manual in terms of needing to run a set of custom scripts based off your calendar URL, and I wanted something a little more robust.

## Option 3: Home Assistant

I do have a spare Raspberry Pi in my basement running [Home Assistant](https://www.home-assistant.io/), which I mostly set up to tinker with and then forgot about. It's not really doing anything. It'd be nice if I could potentially use that to drive the light status, as that seems to be pretty much exactly the sort of thing Home Assistant is designed to do.

The question then is how to alert Home Assistant when I'm on a call? It doesn't really "see" my Windows based computer by default in order to know whether I'm on a call or not.

Luckly, there's a really great "agent" application for Windows called [HASS.Agent](https://hassagent.readthedocs.io/en/latest/) which will install as a [Windows service](https://en.wikipedia.org/wiki/Windows_service) (which ensures that the operating system will always ensure it stays running in the background), and enables you to configure a suite of "sensors" on your machine that will report their status to Home Assistant.

### Setting Up MQTT in Home Assistant

In order for HASS.Agent to communicate with Home Assistant, you first need to add the [Mosquitto MQTT broker add-on](https://mosquitto.org/) to your Home Assistant instance, which you can do by going to Settings -> Add-ons -> Mosquitto Broker and clicking the Install button. MQTT is an open source message queue that enables services to publish events to Home Assistant an an asynchronous manner.

{% include figure.html filename="on_air_light_screenshot_2.png" description="Installing the Mosquitto MQTT broker add-on in Home Assistant" %}

Once the Mosquitto broker is installed, there are still a few more steps to confiure it so that HASS.Agent can connect to it. First, check the "Watchdog" option, so Home Assistant will automatically restart the add-on if it crashes. then click the Start button.

**There's still one more step to actually allow services to talk to Home Assistant via MQTT**. This one is easy to miss. Now that the MQTT service is running, go to Settings -> Devices & Services -> MQTT -> Configure. I overlooked this step and it took me a while to figure out why HASS.Agent was not able to communicate with Home Assistant, so make sure you don't skip this step.

{% include figure.html filename="on_air_light_screenshot_3.png" description="Enabling the MQTT service." %}

### Setting up HASS.Agent

Now that MQTT is running in the Home Assistant instance, we can actually set up HASS.Agent. First, you might want to create a user in Home Assistant for HASS.Agent to use when communicating with your instance. You can do this by going to Settings -> People -> Add Person and then creating a new user with a password of your choosing. I named mine `hass_agent`:

{% include figure.html filename="on_air_light_screenshot_4.png" description="Creating a user in Home Assistant for HASS.Agent to use." %}

With that done, we can now run the HASS.Agent installer and step thorugh the handy setup wizard. HASS.Agent has a bunch of capabilities for letting Home Assistant *control* your Windows machine and use it as a media player, etc. For my puroses, I don't really plan on using any of that. I just want to expose some "sensors" from my machine to Home Assistant so that I can create triggers based off of them.

So, I left the Local API and Satellite Service options in HASS.Agent unconfigured. The main thing you want to ensure is that you configure the MQTT settings using the user account credentials we just created above.

{% include figure.html filename="on_air_light_screenshot_5.png" description="Configuring MQTT in HASS.Agent" %}

### Creating Sensors

Once HASS.Agent is installed and configured to talk to your Home Assistant instance, you can create some sensors. Originally, I was thinking I could base the light off of the status of my webcam. HASS.Agent does include a "WebcamActive" sensor which would work for this method. It also has a "MicrophoneActive" sensor which would work if you're more of a voice-only meeting person.

However, those still won't capture the situation where you're on a work call but have your camera off and microphone muted, say if you're listening in to a big all-hands meeting. If you still want to capture those, we can use the "ProcessActive" sensor.

In order to do that, we need to identify a process that only runs when actively on a call. Luckily, that's just the case with Zoom (which is what my work currently uses for remote video calls).

{% include figure.html filename="on_air_light_screenshot_6.png" description="Task Manager showing all processes with 'zoom' in the name when not on a call" %}

The above screenshot shows the Zoom processes that run all the time, even when you're not on a call. This is just the zoom idle process that gives you meeting reminders and such. Obviously we can't base the sensor on that, because you'd appear to always be on a call whenever your computer is on.

However, compare the above to the same screenshot when a call is active (note that my camera and microphoner were both inactive when capturing this screenshot): 

{% include figure.html filename="on_air_light_screenshot_7.png" description="The 'Zoom sharing host' process only launches when a call is active, under an executable called 'cpthost.exe'" %}

So, it appears we can base our ProcessActive sensor off of `cpthost.exe`, which only runs when actually on a call (as opposed to `zoom.exe`, which is just running at all times).

{% include figure.html filename="on_air_light_screenshot_8.png" description="Configuring the ProcessActive sensor in HASS.Agent for CptHost.exe" %}

Note the description in the HASS.Agent configuration window says to omit the `.exe` extension from the process name, so here I'm just entering `CptHost` as the process to monitor.

Once configured, you can click "Store Sensor" and then "Store and Activate Sensors," which will actually send the sensor to Home Assistant.

Back in Home Assistant, you should now see your new sensor under Settings -> Devices & Services -> Entities.

{% include figure.html filename="on_air_light_screenshot_9.png" description="The new 'ZoomActive' sensor within Home Assistant." %}

Now that it's here, we can create automations based on it! I'll cover that in Part 2.