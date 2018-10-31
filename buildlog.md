# Buildlog

This is an experiment. I'm trying to write my own personal MIDI sequencer from scratch using
electron and Web MIDI. Pretty much in the same veins of Matt's loopdrop.

In this buildlog I'll try to document my journey.

## The idea

The idea is to have a minimal UI that allows me to configure my setup and drive everything else from my Ableton Push controller surface. I'm choosing the push because it has way more buttons and knobs than anything else I own and also because Ableton very kindly documented the API to drive this thing down to the last bit.

If you wonder why this is an Electron app and not a Web App, the reason is that I've built a module interfacing with the Push display which uses LibUSB and so I am dependent on node binary stuff which is handily available in the Electron runtime.

In terms of "what will this be", this is going to be a 16 track MIDI sequencer with a drum and a note sequencer which work slightly differently, with 16 patterns à 16 steps per track that can be switched on and off at will independently for each track. Ideally it will also allow for patterns of different lengths, to allow for some forms of polyrhythmicality.

In the end this will drive a combination of synths running on Ableton Live and Hardware, all going through my compact mixer and probably with some effects units spliced in (pretty much the setup I had when playing with live.js at jsconf.eu)

## The beginning (2018-06-28)

This started as a set of small experiments that were a bit aimless. My main concern with this is exact timing and so I started off with figuring out how to divide up the code into stuff that can run in workers and stuff that needs to run on the main thread.

Also, I wanted to see if it is possible to use ES6 modules without the help of any pre compiling, as this is something that I really would like to prevent.

The problem with this approach was that I had too many different threads where I could continue working and so while the code still exists, I ditched it completely and started from scratch.

## The tiny-system approach (2018-08-25)

I've started from scratch building a minimal sequencer core and tried to bring it to a point where it would work precisely and would not start to stutter as soon as the window loses focus. This can only be done with the worker trick, which is a setTimeout loop in a worker that calls the main thread regularly and does nothing else.

The minimal sequencer already has all important concepts like channels and devices and so on baked in and happily plays a small sequence on the first channel as soon as you start the app.

I've tried to keep it all in one file to keep it simple this time.

## Adding a splash of UI (2018-09-07)

I was debating a lot internally wether I want to actually add a real UI or if I could get away with doing the config in, say, a text file. I remembered my experiments with Mithril.js, a very cool little vdom based UI framework and I integrated that into the code. The cool thing about Electron is, that you can simply `require()` something in your normal JS and it will load the npm module without the need of anything preprocessing.

After adding the UI for configuring the channel params (Mostly which devices and MIDI channels to use), I've built a simple first version of the matrix display that will later be used on the Push. The main disadvantage of prototyping this in HTML is the missing multi touch part - A lot of my UI ideas (stolen from both Ableton's push integration and the Novation Circuit) depend on selecting something with one finger, holding that down and then entering notes, for example with another finger. For now, I can emulate that by making one-click selections (something that is impractical for real live usage) but it should allow me to build the necessary abstractions.

I think the next step could be to prototype the note editor, which involves entering notes in different scales. Main point of orientation will be the Note editor from Circuit, because that works well for me, but one question I need to settle on is if I want the used scale to be a global parameter where changing the scale also changes the notes already in the sequencer or if I want to follow ableton's approach and simply save the exact notes and leave them as is when playing. This would allow for more flexibility but also makes it harder to completely switch the key in the middle of a song if you want to.

## Scaler POC (2018-09-13)

One of the key elements of the note editor is the possibility to enter notes in various scales effectively. Like I said last time, I'll model this losely after the Circuit editor, because I like how it works. Today I've started to work on the piece of code that will translate from a position on the matrix to the actual note value and vice versa. I call this piece the scaler. The UI portion is kept in the MatrixView class. It was relatively straight forward with the exception of the overlapping notes that are also featured on the Circuit. The base note of the scale is present on both edges of the matrix, so that if you select the base note on the upper row, the last LED in the top row has to light up as well. The code for this is terrible and made me question my approach, but it works for now...

I should probably start on the Push integration soon...

## BIG Sprint I (2018-09-29 - 2018-09-39)

I found myself with a mostly free weekend and took the chance to push this forward in a big way. I did the Push 2 integration, including driving the display using [the library](https://github.com/halfbyte/ableton-push-canvas-display#readme) I built earlier. I wrote most of the stuff down on a long list and checked it off, so let's see:

- Built a simple, single file persistence (Needs improvement)
- Switch Channels via Push (using the button row above the display)
- Show channel numbers and active channel on the display
- Added a simple drum sequencer (needs work to be volca and circuit compatible)
- Built a simple pattern chaining mechanism (no random chains, just ranges as Ableton's push integration)
- The current playhead position is shown on Push if the current pattern is played
- Play / Pause via Push (yeah)
- Delete Patterns and Notes and Steps via Push
- Edit Note Velocity and Length via encoders on Push (Hold step pad)
- Set Tempo via Tempo Knob on Push (also: Display Tempo on Screen)
- Note Preview (Play notes when hitting the note pads)
- Implement the Push Accent button (simply fixes velocity to 100 atm)
- Enabled editing the scaler config (scale and root note) via Push encoders
- Changed the way steps are selected (now only if you hold the pad)
- Mute and Solo tracks
- Realtime Recording (this seems to work ok for now, might be a bit imprecise)

## Controllers Pt.1 (2018-10-03)

Today I started to flesh out an Ableton Live set that will be the backbone of my first improjam live performance. On the way, I quickly found out that I definitely need a way to control synth params - The downside of the software only setup I'm striving for right now (mostly for convenient travelling) is that there are no additional knobs to play with on extra hardware - during jsconf.eu I had tons of hardware with me and I twiddled them knobs all the time.

The way I solved this for now is that pushing the "Automate" button on Push changes into "Controller Mode" where the 8 knobs on top of the Push will act as Controller 71 - 79 (like they originally do on Push) and send them on the activated channel. That way I could define 64 controllers and MIDI map them in Ableton Live. The display shows a bar for the value (0-127) and the value. Ideally, later, I also want to be able to define a label for the control, so that I can show that on the display as well to help during the performance.

I've also finally added swing (forward and backwards) as a global parameter in the sequencer.

Then I implemented sync output so that I can sync up Ableton effects to imrojam. I found some interesting quirks in my sequencer maths, but I got a MIDI spec conformant implementation in the end that sends out timing pulses all the time and then on start sends a start message and resets the internal tick counter. There are still some weird issues with Ableton lagging a bit behind (I assume it's not syncing on the correct tick) but that will have to wait.

I've also fixed an issue where drum previews were too short if the triggered instrument doesn't have a proper one shot mode.

And in the end I built in the possibility to have more than 16 drum sounds by allowing to switch through the octaves as with normal instruments.

The one function I really want to have for the drum sequencer is to be able to retrigger drum sounds within a step, but for that I need to fix the "edit note" view for the drum sequencer, so that's going to be one of the next steps.

The resulting Ableton Live set will probably be available as well after the first performance, but this will need *a lot* more work before I can use it. The idea behind the set is to have a good set of different sounds to be able to play different genres but make them relatively versatile by adding sensible controller mappings - and then keep it all in one big live set that will hopefully not tilt my poor little laptop.

## Cleanup, Sync, Note Repeat, Copy (2018-10-08)

Originally I hoped to get some work done on the weekend, but unfortunately I spent the few hours I had (the weather was too good to spend at a keyboard) on trying to figure out a weird Windows 10 issue where npm wouldn't find binaries in `node_modules/.bin`. I still don't know what happened, but I have it fixed somehow. So now improjam is fully windows compatible, even the display works fine after installing the correct WinUSB drivers. The MIDI port names are as crappy as usual on Windows, but nothing a few Regexps can't fix.

While extending the Ableton set further (I added a couple of Trap style instruments I used on a recent track sketch), I tried to fix my sync issue, where notes coming from improjam are registered way too late in Ableton Live. I now have a fix that works okay-ish - I slightly changed the moment I send out the start command and I also tell Ableton to slightly correct the clock (by -28ms on my iMac). This needs more tests, especially on other computers, but I would love to understand what's going on here. I think I need to play around with this a little more to understand the issue, probably also with other hardware that's able to send sync signals, such as Circuit. I suspect Ableton being at fault here, as MIDI Monitor shows the MIDI messages (Sync and Notes) coming in with identical timestamps but Ableton records the notes as if they came it a lot later.

I've also implemented the note repeat feature I needed for the obvious trap hihats. Not sure if this is the best solution, but it works and it is quite fun. "Repeat" is simply another note parameter such as length and velocity.

For this to work I also finally had to fix the "note edit" mode for drums.

I also built a pattern copy which even works across tracks. And to give a bit of visual feedback, I've added a couple of "mode" displays, so that the operations are shown on the screen.

Last but not least, I hacked in a simple way of showing controller names below the controller knobs. This should be configurable (Maybe even via the App UI) but for now it's just a module containing a 2d array.

Also, I finally cleaned up the repo, renamed a couple of files, deleted everything that wasn't needed and extracted all classes from `system.js` to single modules.

## Chromatic Keyboard, Active Note Display, Step bars (2018-10-09)

Finally I built the chromatic note display so that I can play notes outside of the scale. I think I should activate this differently, not by changing the scale but by maybe pressing the (currently unused) Note button.

I also finally tackled the "active note display" which highlights the notes currently played in the keyboard / drum selection section. Not only does this look cool, it is also valuable feedback.

I also quickly implemented a step indicator with some sort of progress bar at the very bottom of the push display which should help with anchoring during live recording.

I also greatly enhanced the Live set, but there's so much left to do. The drums need some work and I need a sampler and some cool JS related vocal samples. I think I need to bring my pocket recorder to be able to record these, or maybe I can salvage something from the Nested Loops performances.

There are a couple of high priority items left open on my technical backlog as well, but I have two long train rides left until the first live performance and three evenings with a good chance of some time to work on this.

## In Transit (2018-10-10)

I finally added a proper menu to the Electron app, allowing me to start to tie together a couple of things. I started with the "New" menu item which will reset most of the app and delete all sequences, except for the Channel settings. I think I will treat those separately from the actual file contents (more like a setting) and will autosave them or so.

Later today I've also implemented Load and Save Dialogs that save and load "songs"

Last change was to allow me to send clock sync to more than one output. This will hopefully enable syncing with Sam's stuff.

## Another train ride (2018-10-11)

I wanted to store a couple of settings per channel instead of system wide, mostly the currently selected pattern (a real continuity issue) and the octave. So I did that.

I also finally got rid of a really annoying issue where I would call the function to refresh the matrix display for each matrix button, resulting in way to many refreshes.

## The day before (2018-10-12)

While waiting for the sound system at the Ruhr.js location to be set up, I've implemented a first version of beat repeat, but I had to rebuild a couple of parts later on to make it work properly.

## Finally back at it (2018-10-31)

Did some initial design work for the web view to not look like 1992. Implemented a couple of features from the backlog (see [Github Issues](https://github.com/halfbyte/improjam/issues) for more details):

- Replace the Settings/Song system with a template system that allows me to load templates (basically: Settings for a specific setup) while also saving all information including the settigs with the song.

- Allow to quickly shift the octave of a note (or multiple notes if on the same step) by holding the note and using the octave-up/down buttons.













