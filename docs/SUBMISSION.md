# Devpost submission draft

Category: **3 - Event Mini Game**

## Name
Sky Combine

## Tagline
Five drills. Two minutes. Are you pro material? A booth mini game that scouts every fan like a pro prospect.

## Inspiration
Every fan at an esports booth has the same question: how would I do? Traditional sports answer it with a combine, a short battery of drills that turns raw skill into a scouting report. Esports booths usually offer a full match (too long, too intimidating) or a single reaction test (over in five seconds, nothing to take home). Sky Combine sits between the two.

## What it does
A fan grabs the mouse, picks a callsign, and runs five 15-second drills: Reaction, Flick, Tracking, Trigger Discipline and Map IQ. Nimbus, a scout drone, explains each one in a sentence, so nobody at the booth has to. At the end the fan gets a scouting report card with an overall rating, a tier, a role archetype, a five-axis radar chart and a QR code that opens the card on their phone. A second monitor shows the live leaderboard, per-drill leaders and who is playing right now.

It is built for the realities of a show floor: mouse only, no network needed after first load, resets itself between players, plays its own demo run when idle, and lets staff export the day's scores as CSV.

## How we built it
Vite and TypeScript with no framework, so the whole game is a static site. Three.js renders the arena (shader grid, particle bursts, bloom) under a DOM HUD. Every sound and the music are synthesised at runtime with WebAudio. Scoring is a pure, unit-tested module. The leaderboard uses localStorage and BroadcastChannel so the game and the board window stay in sync on one machine with no server. A service worker makes it run offline.

All art, names and audio are original. No game assets and no match data are used.

## JetBrains tools
TO FILL IN after the JetBrains work is done: which tools were used, for what, with concrete examples. Nothing goes here that did not happen.

## Challenges
- Making five different drills feel like one game: one palette, one mascot voice, one HUD, and a colour mood per drill.
- Keeping input responsive on unknown booth hardware: render quality steps down automatically when frames get slow.
- Offline caching that survives a redeploy: pages are fetched fresh when online, hashed assets come from cache.

## What's next
Team mode (fan vs fan on two stations), sponsor-branded drills, and a season leaderboard across events.

## Built with
typescript, vite, three.js, webaudio, vitest, github-actions

## Video outline (under 3 minutes)
1. 0:00 Hook: the attract screen and the one-line pitch.
2. 0:10 A full run, sped up between drills, at real speed for one moment in each.
3. 1:30 The scouting report: rating, archetype, radar, QR scanned on a phone.
4. 1:55 The second-monitor leaderboard updating live as a run finishes.
5. 2:15 Booth features: offline, idle demo run, CSV export, reset.
6. 2:35 How it was built and the JetBrains tools used.
