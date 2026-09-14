# Goal

Create an open-ended, client-side Three.js simulation of being Clu in the original 1982 TRON maze. Prioritize atmosphere, spatial presence, believable perception and autonomous Recognizers over game balance or a structured chase.

## Current user direction — September 12, 2026

This supersedes the earlier 60–90-second escape-game scope. The user wants a true branching maze and independent Recognizers placed outside it at startup. They wander, look for Clu, pursue actual sightings, share observations, and search from last-known position and heading after losing sight. They must not know Clu's live position through walls.

Subsequent corrections: the maze should be diagonal and shard-like rather than square/blocky, and Recognizers should be smaller, using the user's approximate 30-foot upright leg as the scale reference.

## Experience pillars

1. **A place to inhabit.** Explore branches, loops, dead ends and exterior grid openings without a timer, assigned route, capture meter, waves or win/loss interruption.
2. **The 1982 shapes.** Broad blue slab tops, black channels, oblique edges and clipped ends. The supplied film stills guide the reconstruction; they do not expose a complete maze map, so unseen passages remain an authored approximation.
3. **Independent observers.** Five Recognizers begin in pursuit outside the maze, with four additional patrols scattered within it. Each has its own motion, view direction, sighting memory and search decisions. Radio messages preserve the age and origin of an observation.
4. **Information-limited pursuit.** Wall geometry occludes vision. Once hidden, Clu's unobserved movement must not influence navigation. Prediction follows the last observed velocity for a bounded time and stops at mapped walls; stale memories expire.
5. **Direct vehicle control.** WASD/arrow movement, including turning in place; J/L independent turret rotation. The barrel stays level and shots lead the observed three-dimensional velocity when a target is aligned and unobscured. Cannon fire remains available without a combat objective.
6. **Quiet presentation.** Minimal default interface, optional instruments/map/aerial view, spatial aircraft audio that becomes muffled behind slabs, and the film-inspired typing terminal.

## Current implementation and limits

The maze uses a fixed, reproducible branching topology transformed into oblique convex slab polygons. Rendering, collision, projectile blocking and line-of-sight use the same polygons. The Recognizer geometry is scaled to one half of the prior build: upright legs about 9 m / 30 ft, with corresponding hit-volume, clearance and separation adjustments.

Both vehicles now load user-supplied Sketchfab GLBs: arabinowitz's tank and Shriker1's Recognizer. The adapters retain source proportions, normalize scale/axes, separate the tank cannon assembly for yaw, and restore emissive trim. Exact film fidelity remains subject to visual review.

All logic, rendering and sound remain client-side. No accounts, backend, multiplayer, progression or deployment are required. See `docs/_index.md` for the current plan and historical milestones, and `docs/validation/_index.md` for measured checks and remaining visual/human review.

The blueprint trace loads by default (also available with ?maze=blueprint). Twenty user-image roof outlines define rendering, collision and occlusion. Scale and wall height are provisional because the image has no measurements; cropped edges are preserved. The original authored maze remains available for comparison at /?maze=authored.

Recognizers now attack visually located Clu by turning and closing their legs, then dropping vertically. The attack commits before descent and can miss. A direct crush leaves an immobile wreck; R resets the simulation, with no score or game-over screen.

Recognizer horizontal propulsion follows its facing direction only. It retains momentum through yaw turns, slows through drag/braking, and stays level without helicopter-style pitch or roll. Vertical lift and the crush drop remain independent.

The in-game title is Space Paranoids. TRON remains the film and visual reference.

The opening fades the typed access terminal into the grid, then moves the camera down to Clu while Recognizers continue their simulation. Reduced-motion preference skips the move; Enter/Space can skip it.

Recognizers lose interest after confirming Clu is crushed, either by direct sight or radio. They complete any attack recovery and return to patrol; stale sightings cannot revive pursuit of the wreck.


September 13 updates: the terminal remains black until Return, with a block cursor, uneven typing cadence, character clicks after browser audio unlock, and a synthesized two-tone access beep. Recognizers patrol during the camera descent while Clu starts at maximum speed with forward throttle held until W is released (pause/blur also clears it). The tank starts one maze width outside the entrance; radio reports travel only 1,000 feet (304.8 m), including vertical separation. Gameplay has no top header; standby is small top text, and any key resumes. Held driving/turret keys carry through resume; fire/reset/view keys are consumed. The follow camera orbits with the turret. Ground/maze fog remains identical within 250 m and tapers to retain distant silhouettes. Wall contact retains sliding speed and clears blocked drive pressure for immediate reverse. Tank sound is 30% quieter with subtle turn-dependent pitch/filter modulation.

September 14 follow-up: Recognizers now use model scale 0.65 (30% larger), with physical clearances and projector mounts adjusted. P enables the stabilized first-person sight, J/L yaw, I/K elevate, O zooms, and F levels elevation. Gunner aim has short acceleration/deceleration and zoom-sensitive rates. Clu rounds travel up to 825 m. Clu destruction now fades back to the film terminal message and Return starts a fresh run.
