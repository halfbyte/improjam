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
