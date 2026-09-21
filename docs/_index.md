---
title: Implementation plan
topTitle: TRON
subtitle: Open-ended maze simulation and historical M0/M1 plans
---

## Project documents

<div class="card-grid cols-2">
<a class="card" href="assets/index.html"><h3>Assets</h3><p>Models, sounds, dependencies and source credits.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="models/index.html"><h3>Models</h3><p>Imported tank and Recognizer files, scales and material adapters.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="references/index.html"><h3>References</h3><p>Film stills and visual targets for the maze and vehicles.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="sounds/index.html"><h3>Sound library</h3><p>Listen to sound candidates, compare current effects, and browse future resources.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="validation/index.html"><h3>Validation</h3><p>Browser checks, measured results and remaining review.</p><span class="arrow">View &rarr;</span></a>
</div>

## Current direction — open-ended simulation

### Carrier shadow edge correction — September 21

- [x] Increase the moving carrier's shadow tile from 1024 to 4096 pixels over its 1500 m light-space span (about 0.37 m per texel). Use a compact 6×6 Gaussian-weighted depth-comparison filter at texel centers, retaining receiver-plane correction; never interpolate packed depth values. This supersedes the first four-tap refinement and softens the remaining fine edge serrations. Reduce the carrier-specific depth bias for its long depth range. Keep maze/Recognizer tile sizes unchanged and preserve the floor grid and emissive materials.
- [x] Compare shadow edges against independent ray/box intersections for stationary and translated casters, check the actual carrier on walls/floor, and inspect before/after captures. This remains a finite-resolution filtered dynamic shadow, not exact vector geometry; the larger tile increases GPU memory/render cost. See validation for browser results.


### Optional tactical movement and Jev — September 21

See [Jev enemy control](jev/index.html) for the implemented architecture, input/output examples, scheduling, validation, and current limits.

- [x] Start the browser in Tactical + Jev with the full enemy population (small encounter disabled), and retain Classic/local tactical modes in Shift+T tuning, with an explicit Apply/restart button and persisted preference. Optional comparison roster: two Recognizers and one ground tank. Tactical modes suppress pursuit reinforcements; Classic restores the original roster/controller. Tactical run seed is 1982; page-local maze layout remains stable for comparisons.
- [x] Replace the tactical stomp's circular clearance rejection with conservative oriented aircraft bounds, triangle-level wall checks, and bounded swept tests for translation, rotation and descent. Generate staged climb/turn/travel/align approaches and orientation-aware low-corridor routes. Follow them with the existing inertial forward-thrust/lift/yaw dynamics. Recheck movement and separation corrections against geometry; a blocked maneuver replans rather than driving through walls.
- [x] Give airborne and ground units choices for withdrawal, regrouping, pressure, cover/ambush and attacks. Wounded units prefer retreat; ground units cease firing while withdrawing. Preserve committed movement, but invalidate stale routes and react to injury. Coordinated choices see nearby allies' intentions within radio range; no hidden live Clu state enters planning or requests.
- [x] Use Jev only for units with a fresh recorded Clu position within one maze length (horizontal distance); distant or unaware units use local tactics. Never gate using hidden live Clu coordinates. Send structured self state, dated target memory, nearby allies, local static wall geometry and candidate pose sequences to Jev. Include precomputed travel distance, visibility relative to the last known target and supporting-unit counts. Jev chooses only a supplied candidate ID; local collision/controller code remains authoritative. Inspect recent requests, probabilities and real elapsed latency in the tuning panel.
- [x] Connect the ignored server-side credential file or environment key through a local Vite dev/preview endpoint. Bound request size/rate/hourly total and timeout; label fallback explicitly. Abort/discard stale answers on pause/reset/mode changes and reject invalid IDs or low-confidence choices. Protect credential files from Vite static serving and Git.
- [x] Check provider browser access: CORS preflights from local origins are rejected, so direct browser calls are not viable in the tested setup. Keep the same-machine relay; initial real end-to-end calls measured 317 ms and 292 ms. This is a local optional service, not a change to the static production deployment.
- [x] Replan on sight loss/reacquisition, newly received or expired contact, an observed velocity change of at least 8 m/s, or target displacement of at least 45 m. These events bypass the normal commitment gate with a 0.65-second event cooldown. Preserve momentum and committed attack phases; reject Jev answers based on superseded observations/revisions. Healthy units actively follow the bounded last-known path, then inspect nearby branches instead of favoring passive ambush. Search hypotheses never become sightings or authorize blind attacks. Ground route refresh follows a new tactical plan.
- [ ] Human comparison of encounter quality, retreat behavior and longer Jev sessions. The planner is bounded and conservative, not a globally optimal flight/attack planner. A geometry-valid maneuver is not a guaranteed successful strike on a moving target; some narrow spaces remain inaccessible. Choosing better actions than the local policy remains an experimental question.

September 21 hearing: aircraft and ground enemies receive bounded, expiring acoustic observations for engines, cannon fire, impacts and explosions. Use distance attenuation, wall muffling and deterministic bearing/range error; never copy a sound into confirmed sighting memory. Unknown sounds permit local investigation and nearby Jev requests with `target: null`; friendly sounds are context only. Hearing is independent of player audio volume and pauses with simulation. Range controls are available in development tuning. See [Jev enemy control](jev/index.html#hearing-input) for the report format and limits.

September 21 connected-search follow-up: persist whether the last-known location has been checked, so moving into a branch cannot re-enable a return-to-origin maneuver. Build a bounded graph of tank-passable corridors from the predicted contact point (8 m steps, 160 m path budget, swept wall checks); use its reachable locations instead of nearby open cells across arbitrary walls. Retain completed checks for the search episode, advance both ground and air units on arrival, and share `search` progress plus each candidate's `searchPath` with Jev. Aircraft already above the roof search from above instead of descending at every checkpoint; feasible low search routes remain available to settled low aircraft. Regression checks cover an L-shaped route, disconnected pockets, continuous aircraft search and ground progression.

September 21 opening-pursuit correction: above-roof aircraft proceed toward the travel waypoint while turning/climbing, rather than returning to the route origin after inertial drift. Healthy units receive a pursuit/support maneuver and no longer prefer regrouping simply because allies are spread out. Reserve attack spacing only for a nearby strike or active stomp; retain local swept collision checks and knowledge-limited target prediction. A moving-opening regression requires all five pursuers to close distance and exceed Clu’s normal speed.

Design references: the [Tetris example](https://github.com/Yasserbhb/Agent-JEV-Tetris) measures reachable action outcomes and avoids conflicting directional hints; the [Doom example](https://github.com/lukaske/jev-doom-agent) uses structured observations, selected maneuvers and local motor control. This implementation is independently written; no external game code or assets were copied. API shape follows the [TypeSafe quick start](https://docs.typesafe.ai/introduction/quickstart).


September 21 grid alignment: maze-site origins now snap to the 24 m world grid, with seeded rotations restricted to 0°, 90°, 180° or 270°. The initial maze stays at the origin and unrotated. Rendering, collision, patrol locations, data beams and teleport pads derive from the same site transforms. Preserve the authored diagonal wall ends and blueprint shapes within each site.

### Exterior teleport pads — September 20

- [x] Place four glowing red 2×2-grid-cell (48 m) square borders around every maze, clear of exterior walls. Each has a stable link to a pad at another maze; together the links reach all other sites. The latest revision snaps every border to the 24 m world grid and uses exactly two cells per side, superseding the earlier 64 m size. Snap away from the maze to preserve exterior clearance. There is no fill. Render borders directly in the floor shader to eliminate competing coplanar surfaces. Share the grid’s 0.10 m half-width and derivative antialiasing calculation; vehicles and walls naturally occlude the floor. This supersedes the separate plane and depth-bias attempt. Apply border color to the shader’s outgoing light (not the already-consumed diffuse input); browser captures confirm visible grid-width borders. Pads are authored in `src/levels/teleporters.js`.
- [x] Trigger only when the complete horizontal vehicle footprint is contained in the square, including a tank's rotated turret. The activation column has no altitude limit. Clu, enemy tanks and Recognizers share the simulation path; the enormous carrier cannot fit inside these pads.
- [x] Freeze propulsion and interactions during a 2.75-second reverse materialization effect, relocate, then play the normal 2.75-second materialization effect. Preserve heading and aircraft altitude; resume at rest. Snap Clu's camera to the destination rather than traversing the intervening world. Pause freezes effects and reset clears transit state.
- [x] Reserve destinations to prevent simultaneous arrivals; defer a transfer if occupied, including a vehicle entering during dematerialization. Require the arriving vehicle to leave the pad completely before it can trigger another trip. Enemy perception, weapons, collision damage and audio exclude vehicles in transit without inventing a remote sighting.
- [x] Verify whole-footprint entry, rotated turrets, altitude, departure/arrival phases, occupied destinations, reentry locks and reset in simulation checks. Drive Clu onto a pad in headless Chrome; verify both effects, pause, arrival, ground-tank/Recognizer transfers and reset, with rendered captures and no browser errors. See [Validation](validation/index.html).

### Wireframe rezzing and pursuit reinforcements — September 20

September 21 awareness correction: on completing reinforcement materialization or an enemy teleport arrival, synchronize with active airborne and ground allies within the existing 304.8 m three-dimensional radio radius. Copy the freshest recorded sighting and alert state, retain observation timestamps, and share confirmed target destruction. Exclude unconfirmed spotlight acquisitions. Fresh pursuit knowledge suppresses searching spotlights; arriving units still need their own visual observation to set `canSee`.

- [x] Reveal a vehicle with one front-to-back wireframe sweep. The rectangle starts as a horizontal line and expands vertically for 0.6 seconds, then travels for 1.8 seconds from 6 m ahead of the nose to 6 m beyond the tail. After the wireframe sweep, fade the whole solid vehicle in over 0.35 seconds while the rectangle and temporary edge overlay fade out. Activate the vehicle immediately when that fade finishes (2.75 seconds total). This supersedes the earlier two-pass design at the user's request. Animation follows simulation time, including pause. The supplied Homeworld Hyperspace clip is a motion reference, not a shipped game asset.
- [x] Use one shared continuous-pursuit clock for airborne Recognizers. Every twenty seconds in Classic mode, create exactly one reinforcement near one of the pursuers, regardless of pursuer count. Continue repeating while pursuit persists; reset the clock when no Recognizer is actively spotting/pursuing Clu or Clu is destroyed. Choose a clear nearby air position above the maze and copy only the summoning observer's recorded sighting.
- [x] Hold the incoming vehicle stationary, silent and intangible during materialization. After completion it independently senses, navigates, reports and attacks. Give new aircraft IDs separate from ground tanks; extend visual, spotlight and audio pools and reuse them after reset.
- [x] Hide shadows during the wireframe sweep, then fade ground shadows and dynamic atlas attenuation with the solid vehicle. Rebuild shadow receiver bindings without stacking shader hooks. Keep the dynamic aircraft atlas bounded to the twelve nearest visible aircraft; other aircraft retain projected floor shadows. There is no reinforcement-count cap; very long uninterrupted pursuits still increase simulation, geometry and audio work.

September 21 interval follow-up: the shared reinforcement period is now 20 seconds (previously 15). Tactical modes continue to suppress reinforcements. The browser now defaults to Tactical + Jev with the full enemy population; earlier experimental preferences are superseded once, and subsequent explicit selections persist.

- [x] Fix phantom square/diamond shadows after reinforcement shadow-atlas rebuilds. Evict the receiver material's cached GPU program bindings when attaching replacement shadow uniforms, even when the generated shader key stays the same. Otherwise Three can retain uniforms pointing at a disposed atlas. This preserves the actual vehicle silhouettes on roofs and ground; the materialization rectangle remains excluded from casting.

Tuning lives in `src/game/materialization.js` and `src/simulation/reinforcements.js`. The reusable materialization presenter is first connected to incoming Recognizers; starting vehicles still appear normally. The user endorsed carrier launches, data-beam arrivals and reverse-sweep recalls as further uses; those remain future work.

September 20 moving-target interception: add the observed target velocity along the approach direction to the Recognizer's distance-based arrival speed. Previously, an aircraft approaching from behind settled into speed-matched pursuit short of a valid landing prediction. It now continues closing until folding/fall time and residual braking drift permit a committed stomp. Navigation still uses only its own sighting memory; the committed drop does not track subsequent evasive movement.

September 20 tuning: increase Recognizer cruise speed by 10%, from 27 to 29.7 m/s. The existing pursuit multiplier requests 34.155 m/s, compared with Clu's normal 22 m/s and turbo 55 m/s. Raise forward thrust authority from 22 to 24.2 m/s² so drag does not cap flight below the new pursuit speed. Turning, lift, drag and braking settings remain unchanged; carrier formation speed retains its carrier-relative setting. Verification: `npm test` passes all 132 checks; a 60-second fixed-step straight-flight calculation reaches 34.155 m/s. Browser driving feel has not been rechecked for this tuning change.

The user's latest direction supersedes the structured chase roadmap below. The purpose is the feeling of being in the 1982 maze: free exploration and independently simulated Recognizers, without an assigned objective or tuned encounter sequence. [Goal](../Goal.md) and `../AGENTS.md` record the active requirements.

### Maze and shared geometry

- [x] Replace the one-dimensional route with connected branches, loops, dead ends, open courts and four exterior openings.
- [x] Correct the initial square layout into long oblique slabs with diagonal clipped tips. Use the supplied overview as a visual reference; distinguish reconstruction from unseen/inferred layout.
- [x] Share convex prism geometry among rendering, hull collision, camera obstruction, projectile blocking and three-dimensional sight tests.
- [x] Preserve a fixed seed/layout for repeatable comparison. Allow travel onto the surrounding grid and turning in place in narrow passages.

### Autonomous Recognizers

- [x] Spawn five persistent aircraft outside the maze, with independent patrol destinations, headings and motion.
- [x] Limit vision by range, field of view and actual wall occlusion.
- [x] Maintain timestamped local sightings and share immutable observations through delayed, range-limited radio messages. Relays retain the original timestamp/source.
- [x] On losing sight, investigate a bounded projection of the last observed velocity, then search plausible nearby passages. Expire stale knowledge and resume wandering.
- [x] Keep navigation separate from live-player perception so unseen Clu motion cannot steer an aircraft.
- [x] Halve the old model scale to put upright legs at roughly the user's 30-foot estimate. Match physical hit volumes, roof clearance and aircraft spacing.

### Presence and controls

- [x] Remove mission progress, capture zones, waves, victory and defeat. Keep exploration running until paused or reset.
- [x] Keep a level, independently controlled turret and vertical-only assistance for aligned, unobscured targets.
- [x] Render and spatialize all five aircraft. Muffle their sound when walls obstruct the listener.
- [x] Hide instruments by default; add optional H instruments, Tab survey and V aerial view. Keep pause, mute, reduced motion and lower quality.

- [x] Import the user-supplied arabinowitz tank and Shriker1 Recognizer GLBs, preserving proportions, turret yaw, muzzle alignment and reduced aircraft scale. See [Models](models/index.html).

- [x] Add a fixed reference studio for side-by-side film comparisons; iterate on tank trim, gold shoulders, highlights, shadows, floor visibility and oblique maze views.

- [x] Apply the renamed film references and new wall-detail study: thin seams, sparse panels and shallow angled ledges, with a fifth reference-studio view.

- [x] Trace the supplied blueprint and use it as the default game maze, retaining the original at /?maze=authored. Preserve concave notches in roofs, collision and sight; provide a top-down overlay and editable outline coordinates.

### Verification and fidelity review

- [x] Unit checks cover connected branching topology, diagonal-tip openings, hull sweep/sliding, occlusion, sighting memory, radio delay/expiry, independent hidden-player counterfactuals, weapon behavior, resets and fixed-step consistency.
- [x] Complete browser controls, multi-agent lifecycle, production preview and sustained traversal checks for this revision; record their actual outcomes in [Validation](validation/index.html).
- [ ] User review of diagonal forms, scale, patrol presence and sound. Exact film topology and final visual approval remain unresolved.

Run `npm run dev` and visit http://127.0.0.1:5173. Supporting documents: [Assets](assets/index.html) · [References](references/index.html) · [Validation](validation/index.html).

## Historical structured-chase plan

The following records the original M0/M1 work and decisions. Its timed escape, capture and scripted encounter requirements are superseded by the simulation plan above.

Prepared 2026-09-12 from the [shared design conversation](https://chatgpt.com/share/6aa58280-6f74-83e9-a410-aa7c54032fe4). `../Goal.md` defines the experience; `../AGENTS.md` guides implementation.

A first playable is implemented as of 2026-09-12. Open the game at http://127.0.0.1:5173 after `npm run dev`. It includes a roughly 75-second authored canyon, procedural tank/Recognizer models, driving and collision, chase camera, positional synthesized audio, pause/restart, capture, and cannon fire. The user explicitly added shooting during implementation; three projectile hits destroy a Recognizer.

Technical prototype work is substantially complete; M0/M1 are not represented as fully signed off. The supplied multi-angle film stills have now been inspected and used for a second art pass. Remaining items include final asset fidelity, actual Safari and human playtesting, and the unchecked detailed items below. See [Validation](validation/index.html) for evidence and limitations. Supporting documents: [Assets](assets/index.html) · [References](references/index.html).

## High-level roadmap

| Milestone | Result | Completion gate |
| --- | --- | --- |
| M0 — Foundation and visual study | Reproducible browser app, reference/asset inventory, representative canyon scene, model import path, simulation skeleton | Scene runs locally and as a production build; references and gaps documented; lifecycle and rendering smoke checks pass |
| M1 — Playable chase | One 60–90-second authored escape with tank handling, collision, chase camera, one Recognizer, sound, and restart | Full win/fail/restart loop, fair threat, controllable drive, recorded browser and performance checks |
| M2 — Fidelity and feel | Refined or replacement vehicles, closer terrain/material matching, better sound, camera and encounter tuning | Reference comparisons and playtesting resolve the main visual and experiential gaps |
| M3 — Browser release candidate | Loading polish, quality settings, accessibility basics, compatibility/performance fixes, asset credits | Repeatable production build and documented release checks; ready for a separately authorized deployment |

Keep later milestones flexible. Basic cannon combat was explicitly requested and is implemented. M1 playtesting should determine whether additional enemies or more elaborate combat add value before expanding scope.

## Working technical decisions

| Area | Initial decision |
| --- | --- |
| Runtime | JavaScript ES modules, Three.js `WebGLRenderer`, Vite; plain HTML/CSS overlay |
| Browser baseline | Desktop Chromium and Safari on the development Mac; Firefox smoke check before M1 closes; WebGL 2 required |
| Simulation | Fixed 60 Hz update with interpolated rendering; cap accumulated elapsed time and catch-up steps; pause on hidden tab/focus loss |
| Tank | Kinematic arcade controller on an essentially flat driving surface; acceleration, braking, speed-dependent steering, limited reverse |
| Collision | Simplified authored canyon boundaries and tank footprint; sweep fast movement, slide along walls, handle corner contacts |
| World | Authored route data with canyon sections, collision boundaries, waypoints, encounter volumes, start and exit |
| Camera | Low third-person chase, damped position/look target, turn anticipation, obstruction correction |
| Enemy | Explicit approach/overtake/intercept/recover states following authored flight paths and bounded player-relative targets |
| Assets | GLB/glTF through a replaceable model adapter; reusable procedural facets for terrain; original or permitted audio |
| Rendering | Solid flat-shaded/faceted forms, controlled gradients and fog; optional restrained bloom/softness/grain |
| UI and tuning | Minimal DOM HUD; development panel for handling, camera, enemy, palette, fog, bloom, and render scale |
| Persistence | Settings only if useful; no backend or saved progression in M0/M1 |

The current [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html) specifies WebGL 2 and no WebGL 1 support. Use the documented [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) import path. At setup, choose compatible stable dependencies, check the [Vite runtime requirements](https://vite.dev/guide/), and commit the lockfile rather than guessing versions now.

Suggested structure, created as needed:

```text
src/
  main.js
  game/         # lifecycle, fixed-step loop, input, configuration
  simulation/   # tank, collision, recognizer, encounter state
  rendering/    # scene, camera, materials, model adapters
  audio/        # engine, ambience, positional threat sounds
  levels/       # authored route and encounter data
  ui/           # start/results/HUD and development tuning
public/assets/  # permitted models and sounds
docs/           # references, asset manifest, validation records
tests/          # meaningful simulation and browser checks
```

Simulation should expose state to rendering and audio without depending on scene meshes. A reset should recreate run state from route/configuration data while safely reusing loaded assets.

## M0 — Foundation and visual study

### Objective

Make the first implementation session produce a reproducible app and a representative visual scene that can be compared with the film. Establish the model/scale/camera conventions and technical scaffolding needed for M1. Full driving and pursuit are M1 work.

### M0.1 — Reference and asset preparation

- [x] Create `docs/references/_index.md` with identified original-1982 frames or links: tank side/front/rear views, Recognizer front/side/overhead views, canyon-wide composition, and chase-camera framing. Record provenance and timestamp where available; distinguish film frames from fan renders.
- [x] Inspect the actual reference images. Write observations on silhouettes, relative scale, wall profiles, surface gradients, lit details, and framing. Do not use the rejected generated images as vehicle specifications.
- [x] Create `docs/assets/_index.md`: candidate source URL, creator, format, license/use constraints, attribution, size, suitability, and selected/placeholder status. Evaluate vehicle proportions and model quality before selection.
- [x] Prefer suitable open models; record paid candidates and price for a later concrete purchasing decision if needed. Continue with reference-based stand-ins if no usable model is available.
- [x] Record audio needs: engine/load loop, background electronics, Recognizer approach/pass/intercept, collision and outcome cues. Plan synthesized placeholders where usable recordings are unavailable.

Deliverable: a concise reference guide and honest asset inventory, with no claim that uninspected or unacquired assets are ready.

### M0.2 — Application scaffold and lifecycle

- [x] Initialize npm/Vite with JavaScript modules and Three.js; add `dev`, `build`, and `preview` commands, lockfile, `.gitignore`, and setup README. Record the required Node version.
- [x] Create the canvas, resize handling, bounded pixel ratio/render scale, loading/error states, and a useful WebGL 2 unsupported message.
- [x] Create one owned animation loop and explicit loading/ready/running/paused/disposed lifecycle. Bound delta time and catch-up work; reset the accumulator on resume.
- [x] Establish input state with blur cleanup. Reserve WASD/arrow driving, Escape pause, R restart, and M mute for M1; prevent page scrolling while gameplay owns these keys.
- [x] Provide cleanup paths for listeners, renderer resources, and future audio. Handle context loss with a visible recovery/reload state.

Deliverable: clean local startup and production preview, stable resizing and tab switching, and no duplicated loops.

### M0.3 — Representative canyon and model study

- [x] Build a short authored test section containing a straight, bend, irregular wall heights, and an opening. Keep its visual geometry separate from future collision data.
- [ ] Add tank and Recognizer preview adapters with documented dimensions, origin, forward axis, and uniform scaling. Support GLB loading plus labeled stand-ins; preserve source mesh proportions.
- [x] Build a stationary chase composition and an inspection camera. Start with the tank near the lower 15–20% of the image as a tuning hypothesis, then compare with references.
- [x] Establish solid faceted terrain, restrained blue/purple surface gradients, dark distance and sparse emissive details. Add optional postprocessing only after the base materials read correctly.
- [ ] Add development controls for palette, fog, exposure, bloom, camera offset/FOV, and render scale; provide a reset-to-defaults action and a way to record settings.
- [x] Capture a representative chase view and vehicle inspection views. Note remaining silhouette/material gaps alongside the references.

Deliverable: a visual test scene and saved baseline settings. If vehicle assets remain temporary, the milestone report must say so.

### M0.4 — Validation and handoff

- [x] Verify install instructions, development startup, build, and production preview from documented commands.
- [x] Add a small browser smoke check for canvas initialization and startup errors, using Playwright if compatible with the environment. Visually inspect a real GPU-rendered frame; headless launch success alone is insufficient.
- [ ] Exercise resize, tab hide/resume, input blur cleanup, unsupported WebGL behavior, and disposal/reinitialization without duplicated resources.
- [x] Record browser/OS/hardware, viewport and render scale, scene statistics, and observed frame timing in `docs/validation/_index.md`.
- [x] Summarize reference coverage, asset availability, visual gaps, and any changed assumptions before starting M1.

### M0 exit criteria

The app renders its representative scene from both dev and production preview without uncaught errors; basic lifecycle checks pass; model and world conventions are documented; reference comparisons and selected/temporary asset status are recorded. A first visual direction is reviewable. User feedback can refine it while independent M1 controller work proceeds.

## M1 — First playable chase

### Objective

Deliver a complete short escape through one authored canyon. Prioritize handling and camera first, then layer in a readable threat and sound. Initial art must follow M0's reference direction, with unresolved fidelity work explicitly carried into M2.

### M1.1 — Tank handling and collision

Depends on M0's loop, conventions, and test scene.

- [x] Implement throttle, braking, reverse, acceleration limits, drag, maximum speed, and speed-sensitive steering. W/up accelerates; S/down brakes and reverses after stopping; A/D or left/right steer.
- [x] Start with approximately 22–31 m/s top-speed experiments, reflecting the conversation's proposed 50–70 mph feel. Adjust against terrain scale and corner readability; these are tuning values, not fixed requirements.
- [x] Use a tank footprint against simplified static boundaries. Sweep the intended displacement to prevent tunneling; resolve sliding and corners without instability or steering through walls.
- [x] Make wall contact slow the tank and produce mild feedback. Ordinary contact alone does not end the run; loss comes from the defined pursuit rule.
- [ ] Expose acceleration, braking, reverse limit, steering curve, drag, and collision debug display. Preserve a repeatable test course.
- [x] Test displacement consistency across render rates, braking/reverse transitions, high-speed wall contact, glancing slides, and corner recovery.

Acceptance: the tank remains within the drivable corridor, behaves consistently at different render rates, and can be driven through a bend and recovered from wall contact without resetting.

### M1.2 — Chase camera and route

Depends on M1.1; route art and layout can be developed alongside camera tuning.

- [x] Implement damped following and look-ahead tied to heading/turning. Resolve obstructions between camera target and desired camera position with a small clearance volume; recover smoothly when clear.
- [x] Author a route with a learning straight, tight passage, blind bend, wider reveal, second bend, interception opening, and exit. Use landmarks and geometry to make the forward path readable.
- [x] Tune the full route for a 60–90-second successful run; derive length from measured average driving speed instead of assuming top speed throughout.
- [x] Keep spawn and exit volumes clear of collision boundaries. Add route progress tracking and reproducible encounter triggers; backward movement must not retrigger completed encounters.
- [ ] Test camera behavior near walls, inside bends, at low speed/reverse, on restart, and at different aspect ratios. Add reduced camera motion as a simple setting.

Acceptance: an empty-canyon drive is enjoyable and readable before pursuit is added; the camera avoids walls and provides enough forward visibility to react.

### M1.3 — Recognizer pursuit and game rules

Depends on a stable route and controller.

- [x] Add one Recognizer with approach, overtake, intercept, recover, and exit/reset states. Use authored flight lanes above/within clear sections of the canyon and bounded tracking toward the player's progress.
- [x] Stage an audible approach behind the player, an overhead crossing, and a descent into a wider interception area. Use distance/progress triggers with local state timers so pacing tolerates faster and slower players.
- [x] Define the initial failure mechanic: a telegraphed capture zone beneath the Recognizer builds capture exposure while the tank remains inside. Leaving the zone reduces exposure; a configurable threshold ends the run. Show exposure on the HUD.
- [x] Give the capture zone a visible boundary or clear world cue. Ensure the interception leaves a traversable escape lane and never activates before its warning. Tune reaction time from actual runs.
- [x] Reach the exit alive to win. Resolve capture before exit if both occur in the same simulation tick, and prevent multiple outcome transitions.
- [x] Define recovery for a stalled/reversing player and ensure no permanent obstruction or unbounded enemy chase target. Keep tuning deterministic for repeatable testing.
- [ ] Test encounter order, one-shot triggers, capture entering/leaving, threshold behavior, terminal-state priority, and reset. Add a second Recognizer only after the single-enemy loop meets acceptance.

Acceptance: the pursuer creates visible and audible pressure, capture is avoidable through player action, both victory and defeat are reachable, and failure has a clear explanation. This capture rule is a provisional game design choice, not a claim about the film.

### M1.3a — Cannon combat (added at user request)

- [x] Fire with Space or left mouse; hold to repeat at a bounded cooldown.
- [x] Turn the level turret independently with Q/E; assist projectile height only when horizontally aligned with a target (updated at user request).
- [x] Simulate projectile travel with substeps and Recognizer hull/crown/leg hit volumes.
- [x] Show target acquisition, remaining enemy health, muzzle flash, hit flash, debris, and kill count.
- [x] Destroy a Recognizer in three hits and cancel its capture zone.
- [x] Verify stationary-target destruction and all three encounters during a complete driven route.
- [ ] Collect user feedback on aim assistance and whether three hits feel right.

### M1.4 — Sound and player flow

Depends on lifecycle and encounter events; audio placeholders can be prepared earlier.

- [x] Unlock the audio context from the Start action. Add an engine loop driven by speed/load, quiet ambient electronics, positional Recognizer cues, wall-impact feedback, and short win/fail cues.
- [x] Attach the audio listener to the camera, update sound positions from simulation state, and tune attenuation so the approach is heard before the overhead reveal. Audio must not be the only threat cue.
- [x] Provide start instructions, minimal route/capture HUD, pause/resume, mute/volume, outcome text, and R/button restart. Keep technical tuning controls out of ordinary player flow.
- [x] Pause simulation/audio on focus loss; require an explicit resume action. Clear held keys so a missed keyup does not keep the tank accelerating.
- [x] Reset vehicle, camera, enemies, encounter flags, timers, capture exposure, HUD, and audio without reloading assets or the page. Repeated restarts must not layer loops or events.

Acceptance: a new player can start, understand the objective and controls, pause, win/lose, and immediately replay. Muted play remains understandable.

### M1.5 — Verification and playtest

- [x] Run focused simulation tests from M1.1/M1.3, then browser checks for start, real input-driven movement, pause/resume, both outcomes, and restart. A test hook may place a run near a scenario, but must exercise real collision/outcome rules rather than directly setting a win flag.
- [ ] Manually complete a normal winning run and intentionally lose; check that the intercept is fair at both cautious and intended driving speeds.
- [ ] Check current installed Chromium, Safari, and Firefox; record versions and any unsupported behavior. Browser automation can cover Chromium, but does not substitute for checking actual Safari.
- [x] Run 10 restarts and a 10-minute repeated-play session. Inspect console errors, duplicated audio/listeners, and renderer resource counts for continuing growth.
- [ ] Record a timed run, representative screenshots, and notes on tank weight, corner readability, pursuer scale, visual resemblance, and sound timing. Collect user playtest feedback; report subjective judgments as pending until received.
- [x] Update `docs/validation/_index.md`, asset credits, README controls, and milestone status with the actual results and remaining M2 work.

### Performance targets and measurement

Choose and record the baseline development machine in M0. Initial targets are 60 fps at 1920×1080 with pixel ratio capped at 1, and a stable 30 fps lower-quality fallback with reduced render scale and postprocessing. After shader/asset warmup, aim for 95th-percentile frame intervals of at most 20 ms at normal quality or 35 ms in fallback during the full chase. Record measurements rather than claiming broad hardware coverage.

If the target is missed, first reduce postprocessing and pixel cost, then inspect draw calls, repeated geometry, per-frame allocations, and resource leaks. Re-measure after a relevant fix; do not remove the defining terrain/vehicle forms simply to hit a frame counter.

### M1 exit criteria

The full route supports a roughly 60–90-second successful chase, with working collision, readable camera, at least one fair Recognizer encounter, positional sound, victory, defeat, pause, and immediate restart. Required checks and performance measurements are recorded. There are no known blocking control/collision/reset defects. Remaining visual or sound placeholders are listed, and user feedback or its pending status is recorded separately from technical completion.

## Risks and working responses

| Risk or uncertainty | Response |
| --- | --- |
| Suitable vehicle models are unavailable or inaccurate | Evaluate candidates early; use replaceable reference-based stand-ins and record the fidelity gap |
| Generic neon appearance replaces the requested film look | Compare fixed camera captures to original references; fix silhouettes, surface tones, and terrain geometry before adding effects |
| Heavy handling becomes frustrating in tight turns | Tune camera, route width, speed, and steering together in the empty canyon |
| Scripted pursuit breaks at different player speeds | Trigger by route progress and use explicit recover behavior; test stopping and reversing |
| Threat is arbitrary or unavoidable | Telegraph capture, retain an escape lane, and verify successful avoidance with normal controls |
| Browser audio or effects fail on the baseline | Unlock sound through user input, show visual warnings, retain render-scale/postprocessing fallbacks |
| M1 expands into a full game | Keep one route and one enemy until the complete loop passes its gates |

## Design topics to revisit before pursuit implementation

These do not block M0 or the empty-canyon driving work.

- **Player agency:** the user requested shooting, and the first playable now supports destroying Recognizers or evading their capture zones. Playtest the aiming assistance, hit count, and timing before considering alternate passages or further combat complexity.
- **Tension and pacing:** include a brief safe opening and a moment of relief between threats. Continuous maximum pressure can make the Recognizer feel ordinary and leave no room to appreciate the environment.
- **Faithful appearance versus readable play:** keep vehicle and terrain forms faithful while tuning corridor width, camera offset, warning time, and speed for player control. Treat those as deliberate adaptations and judge them in motion.
- **Distinctive sound identity:** aim for separate, recognizable engine and pursuer signatures. A muffled approach, overhead pass, and receding threat should communicate encounter state without requiring the player to look backward.

## Next implementation action

A subsequent user correction removes smooth route interpolation: straight wall sections now meet at hard authored corners. Q/E manually turns the turret; the barrel stays level and bullets receive height assistance only. External replacement model candidates and preview comparisons are in the asset inventory; source downloads require a signed-in Sketchfab account.

The September 12 reference pass replaces the home screen with an animated blue terminal, rebuilds the tank and Recognizer, and changes the maze to flat-topped slabs and grid courts. See the updated reference inventory.

Playtest the browser build, collect feedback on handling, camera, cannon aiming, visual proportions, and pursuit timing, then refine the remaining M0/M1 items before expanding scope. Asset purchases and deployment have not been performed.
## Recognizer crush attack — September 13

- [x] Use the supplied attack frames for turning legs, inward closure and a vertical drop.
- [x] Require recent direct sight and map clearance; commit the strike position before folding so an escaping tank can be missed.
- [x] Recover altitude and reopen after impact. A crushed tank stays in the scene until R resets; autonomous simulation continues.
- [ ] User review of motion timing and final pose against the film sequence.

- [x] Give Recognizers forward-only horizontal thrust and persistent momentum; steer to avoid aircraft instead of applying lateral propulsion. Keep the body level and slow before committing to a crush.

- [x] Increase Recognizer drag and hold heading while braking inside the strike footprint to reduce attack-approach circling.

- [x] Replace competing close-range pursuit/avoidance steering with yielding to a nearer aircraft, turn-in-place alignment, and stable hovering even when a wall prevents descent.
- [x] Use Space Paranoids as the game title and home branding.
- [x] Give V aerial view lighter fog, a visible floor, and grid fading appropriate for its camera distance.

- [x] Add the terminal-to-grid opening and camera descent to Clu, with pause/resume, skip controls and reduced-motion support.
- [x] Extract tank, cannon and two Recognizer samples from the user-supplied local video. Add stereo world emitters, Doppler, wall muffling and a sound audition page.
- [ ] User audition of the film-derived cuts for background score/dialogue and loop character.

- [x] Frame nearby visible Recognizers with a smooth upward camera tilt, modest pullback and wider field of view while retaining the tank top in frame. Keep aerial and studio cameras independent.

- [x] On confirmed Clu destruction, clear sightings, share the result by radio, finish recovery and return to patrol. Ignore subsequent stale sightings of the wreck until reset.
- [x] Suppress the repeating tank-loop tone with a targeted notch and softer high-frequency cutoff.


September 13 updates: the terminal remains black until Return, with a block cursor, uneven typing cadence, character clicks after browser audio unlock, and a synthesized two-tone access beep. Recognizers patrol during the camera descent while Clu starts at maximum speed with forward throttle held until W is released (pause/blur also clears it). The tank starts one maze width outside the entrance; radio reports travel only 1,000 feet (304.8 m), including vertical separation. Gameplay has no top header; standby is small top text, and any key resumes. Held driving/turret keys carry through resume; fire/reset/view keys are consumed. The follow camera orbits with the turret. Ground/maze fog remains identical within 250 m and tapers to retain distant silhouettes. Wall contact retains sliding speed and clears blocked drive pressure for immediate reverse. Tank sound is 30% quieter with subtle turn-dependent pitch/filter modulation.


Opening pursuit: three of the five Recognizers start 120–180 m behind Clu in a staggered formation, already moving forward. Their initial pursuit comes from normal line-of-sight sensing. They remain autonomous during the zoom; the other two patrol the maze.


September 13 pursuit/destruction revision: the three opening pursuers now start abreast 300 m behind Clu, 130 m apart. Nearby squadmates hold separate lateral interception lanes and slow when ahead of the group, creating a broad net. Coordination uses each craft's own target memory and neighbors within radio range. The shot-assistance correction supersedes vertical-only aiming: narrow-cone acquisition remains manual, but the fired projectile aims at a constant-velocity 3D intercept and never homes afterward. Destruction partitions the posed imported model into 18–27 random surface groups, with retained trim, a brief yellow-white flash, inherited momentum, varied spin, gravity, coarse wall/floor collisions and 10–12 s cleanup. Camera interest briefly follows the breakup.


Latest control/coordination corrections: F returns the turret smoothly to forward; Q/E cancels centering. Driving, turret control and firing work throughout the opening zoom. Enter skips the opening; Space fires. Held inputs survive the transition into gameplay, and brief fire taps are queued until a simulation step. Nearby pursuers within 180 m dynamically choose the nearest craft to their own last-known target as lead; it pursues directly while supports flank and trail. Fixed formation slots are removed. Lead destruction or separation triggers immediate reassessment; isolated aircraft pursue independently.


Terminal presentation: text reduced by roughly 30% on desktop, with a subtle four-pixel CRT raster overlay confined to the home screen. Scanlines dissolve with the existing opening text fade and are absent from gameplay.


Turbo/ambush revision: T starts a ten-second 1.75× speed boost, with forward thrust unless braking, no stacking during an active boost, and a smooth return to normal speed. Shift+T opens development tuning. Controls appear centered at the top after three seconds without input, wrapping only when necessary. All five Recognizers now start in pursuit 300 m behind Clu, spaced 100 m apart, and the opening frames the wider group. Stomp planning linearly predicts from the latest observation, accounts for approach, folding and drop time, and includes braking drift at commitment. The committed drop does not track later tank maneuvers.


Final turbo/placement tuning: turbo raises Clu to 55 m/s (2.5× cruise), substantially faster than Recognizer pursuit. It can activate once per 60 simulated seconds, including its ten-second active period; the top-right meter shows boost/recharge/ready state. The five initial aircraft retain the reference-inspired irregular wide line at roughly 300 m distance, but normal altitude is restored so their feet clear the 54 m maze roofs.


Aerial camera: V still toggles the overview; wheel/two-finger scrolling smoothly changes its scale from 0.25× to 4× (150–2,400 m height). Zoom is retained across V toggles, resets with a new run and also works while paused. Ground extent and camera far clipping expand for distant views.

## September 13 — carrier and localized breakup

- [x] Convert the user-supplied Sark carrier DAE with all textures, retaining original proportions, and add an orbitable `/carrier.html` preview.
- [x] Add a straight background flight at 360 m center altitude and 24 m/s, tied to simulation time.
- [x] Fragment only the struck Recognizer body/leg section; let the other two sections fall apart whole.

See [Models](models/index.html) for source, parameters and limitations and [Validation](validation/index.html) for checks.

## September 13 — explicit terminal start

The first screen is a single BEGIN button on black. Activation unlocks audio and waits for sample loading before typing begins. Return retains its skip-text / enter-game behavior. Clicking elsewhere no longer restarts the text. Carrier hull materials now have a restrained blue ambient emission so the whole hull remains visible, including the underside.

## September 13 — roaming map patrols

Four additional Recognizers start at seeded random, separated open map positions above the walls, alongside the existing five opening pursuers. They begin wandering with no target memory and use the same autonomous search/pursuit logic. Placements repeat on restart. Direct detection requires unobstructed line of sight, the existing field of view (including downward vision), and a three-dimensional distance no greater than the maze's longer side. Radio remains limited to 1,000 feet; radio reports are remembered positions, not direct visibility. All nine aircraft have render instances and spatial sound voices.

## Carrier presence and breakup refinement

- Carrier placed farther back and left, with a film-derived stereo rumble candidate and estimated red beacon cadence from the final shot. See References/Assets for timing evidence and limitations.
- Maze wall seams brightened from 0x25334c / 0.48 opacity to 0x354963 / 0.68.
- Recognizer breakup uses six structural sections rather than three rig groups; only one section fragments per destruction.

Clu now breaks apart instead of flattening under a stomp, with visible fracture seams. The carrier now starts 9 km to the left of Clu’s initial heading, outside the normal forward view.

Latest terminal direction: show the complete access text immediately, with no BEGIN button or typing animation/sounds. Return starts the existing dissolve/zoom and unlocks audio. The cursor and CRT treatment remain. This supersedes the earlier explicit-button/typing flow.

The complete home-screen message fades in over 0.5 seconds (no typing); reduced-motion preference shows it immediately.


### Recognizer searchlights — September 13 first pass

Search and investigate states use a sweeping cyan-white beam with a soft blue-violet halo, projected from the crown. Patrols scan intermittently (six seconds per 22-second cycle, staggered by aircraft). The seven-second sweep, 260 m range and spread are provisional until a motion reference is supplied. Aim follows only the aircraft's own goal/memory, constrained to its forward sector; it does not acquire hidden Clu. Rays stop at maze walls/roofs and ground. Attack/pursuit transitions fade the beam; destruction hides it immediately. This is an additive visible-beam approximation, not full volumetric lighting or a projected pool on surfaces.


### Ground escorts — September 14

Eight enemy tanks follow the carrier's X-axis transit on the ground in staggered ranks, 38 m between lanes. They use the existing normalized tank model with red insignia and independent turret joints. Escort cruise can reach 32 m/s to catch the carrier's 24 m/s transit. Sight requires facing, clear line of sight and range no greater than the maze length. Ground and air units now share the same delayed 1,000-foot radio network, including confirmed Clu destruction; relays preserve sighting timestamps.

Observed Clu interrupts escort duty. Nearby ground pursuers reuse dynamic nearest-leader/support formation rules with narrower lanes, abandoning blocked flank slots. Independent turrets lead observed velocity and fire level-barrel rounds when aligned, unobstructed and clear of allies. Lost targets are investigated using bounded last-known prediction, then searched; expired memories return units to their moving escort slots. Walls use swept hull collision and bounded local A* routes. If routing cannot find a path within its budget, the tank holds and retries. Crowded passages may need further driving refinement.

Clu and enemy tanks take three cannon hits; destruction uses the existing fragment effect. Enemy cannon samples are positional. The eight tanks reuse model geometry rather than downloading additional copies. They start far left under the carrier, not near the initial chase.


### Startup presentation — September 14

The HTML supplies a black background immediately and loads the stylesheet through a render-blocking link. Content is hidden until styles apply, avoiding an unformatted text flash. Controls appear at game entry and remain until ten simulated seconds after the first gameplay key press; the Return used to start does not count. Later keyboard activity re-enables the idle reminder. Pausing freezes the countdown, and resetting starts it over. `npm run test:browser -- --startup-ui` passed with deliberately delayed CSS, initial controls visibility, timed fade and subsequent idle reminder checks.


### Gunner view, driving and alertness — September 14

P toggles a first-person sight patterned after `Tank POV cross hairs.png`. O cycles approximately 1×/2×/4× fields of view. I/J/K/L aim vertically and horizontally; J/L rotate the turret in both views; Q/E no longer rotate it. Hull rotation is compensated to hold the sight's world heading. Gunner shots follow the manual sight without automatic target lead/height assistance; the third-person weapon keeps its existing assistance. The visible barrel stays level. Aiming rates scale with the tangent of the zoom field of view for consistent screen-space motion.

Shift+W latches forward throttle until W is pressed again; S overrides it while held. The latch survives pause and clears on reset/destruction. Turbo follows the current motion direction (or requested reverse from rest). Normal reverse caps at 16.5 m/s versus 22 m/s forward; boosted reverse caps at 41.25 m/s versus 55 m/s forward. Both ease back to normal speeds after boosting.

Recognizer alertness is independent of movement state. Actual sightings and fresh radio reports raise an alert until three minutes after the original observation time. Relays do not refresh the timestamp. Searchlights require an alert, no direct visual contact, and no position report newer than 1.5 seconds. They operate while wandering/searching/investigating, fade over the final 30 seconds of alertness, and shut off immediately on reacquisition or confirmed Clu destruction. Routine unalerted patrols no longer scan.

Gunner yaw and pitch now ease toward the requested aiming rate, reaching approximately 95% speed in 0.21 seconds and shedding 95% of motion in 0.14 seconds after release. Hull compensation remains immediate; zoom scales both axes consistently. Centering clears yaw inertia, and leaving gunner mode clears both rates.

On Clu destruction, the breakup remains visible for 1.1 seconds, followed by a one-second fade to the terminal. The terminal displays “ILLEGAL CODE” and “CLU PROGRAM DETACHED FROM SYSTEM” with the supplied film still’s layout, no cursor, and a half-second text reveal. Return starts a fresh run; pause freezes the in-progress transition. This supersedes the earlier requirement to leave the wreck view running indefinitely.

F now levels aim elevation smoothly to the ground plane while preserving turret azimuth, replacing the former forward-yaw centering shortcut. Manual I/K input interrupts leveling.

Clu rounds now last five seconds at 165 m/s (825 m maximum travel). Chase-view acquisition extends to 740 m with a matching five-second intercept horizon. Enemy ammunition retains its prior range.

Recognizers are 30% larger than the previous half-scale version (model scale 0.65). Hit volumes, separation, avoidance, crush footprint/sole height, flight clearance and searchlight mounting offsets follow that scale.

Recognizer destruction now separates pieces outward twice as fast, with a shorter 0.1-second flash and faster tumbling. Debris gravity is 14.7 m/s² with less upward lift; the effect lasts 5–6 seconds with a one-second fade. Only the struck anatomical section fragments; other sections detach whole. Ground-tank breakup timing is preserved.

Recognizer blast-force follow-up: outward impulse is now 2.5 times the preceding version, with faster tumbling. Whole sections scatter outward from the craft center while struck fragments scatter from the impact point, helping the pieces diverge. Vertical impulse and faster gravity remain as before.

Gunner zoom now cycles 1× / 2× / 4× / 8× with O. The fourth level uses a 9-degree vertical field of view; aiming sensitivity automatically follows the field of view.

### Film-inspired Recognizer destruction — September 14

Studied frames from 1:46–1:50 of the supplied Clu scene. Recognizer destruction now uses a brief randomized serrated yellow-white flash, expanding thin double yellow rings, a red after-flash and short-lived orange sparks. The effects stay at the impact in world space, face the camera and respect depth occlusion. Intact sections detach after small randomized delays and tip end-over-end; fragments scatter immediately with varied fracture seeds, spins and an asymmetric blast bias. Only the hit section is fragmented. Strong outward force and faster debris gravity are preserved. The flight loop now uses exactly 2:04–2:06 and destruction uses the stereo 3:06–3:07 excerpt with positional playback.

Clu muzzle flash now follows the supplied still and frames around 1:51: a broad cyan-white scalloped starburst with a blue halo, contracting and fading within 0.17 seconds. It follows the posed barrel in chase/aerial views; gunner mode shows a reduced burst just ahead of the sight. Shot-dependent shape variation, pause freezing and normal depth testing are preserved. Recognizer explosion audio was corrected to 1:47.84–1:48.69 and rebuilt from the supplied M4A with its 47.89 ms offset accounted for.

Gunner view now hides Clu’s muzzle flash entirely; external views retain the cyan burst. Prepared balanced and stronger cleanup candidates for the user-supplied short Recognizer explosion edit, accessible on `/audio.html`; these are audition candidates, not a replacement for the active game sample.

Added a sound resource shelf with 25 entries and 17 local audio players, including four Syna-Max recreations retained for future use. Six stock-effect IDs were checked against publisher catalogs; their association with film scenes remains a community-source lead pending audition. Saved Serafine Sci-Fi I/II metadata exports (420 and 1,028 rows) with source links. This does not change runtime sounds or require an account/purchase.

Nonfatal Recognizer hits now play a dedicated 0.3-second synthesized armor impact: electrical snap, low body and brief inharmonic metallic ring. Each impact is positioned at the bullet strike with small pitch variation. Hit events identify target type and fatality so the armor sound is omitted on destruction. Runtime synthesis and the audition WAV share `src/audio/recognizer-hit.js`; regenerate the WAV with `node scripts/generate-hit-sfx.mjs`.

- [x] Support static deployment under `/fun/TRON/` with relative build and audio paths; verify the production build in Chrome.

- [x] Match enemy tank top speed to Clu normal cruise (22 m/s), with turbo exclusive to Clu; carrier transit matches escort cruise. Add brief impact camera vibration for bullet hits and wall collisions, scaled by impact and gunner zoom.

- [x] F now returns turret yaw forward and elevation level together, using manual aim rates, gunner acceleration and zoom sensitivity. Manual input overrides each axis independently.

- [x] Cannon refills all three extra shots together after ten seconds without firing. Fresh Space/click presses may spend extras to bypass the 0.38-second recharge; held fire retains the normal cadence. Any shot restarts the full ten-second reserve recharge. Instruments show banked extras.

## Patrol mix and spotlight confirmation — September 15

- [x] Two initial Recognizer pursuers plus one maze patrol; three ground maze patrols in addition to the eight carrier escorts. Patrol tanks choose reachable routes through clear maze cells and retain the shared perception/radio rules.
- [x] Searching Recognizers smoothly aim their projector at a candidate sighting while braking. No new target memory, pursuit, or radio report until the beam actually aligns within visual detection range with unobstructed projector-to-Clu visibility.
- [x] Confirmed beams track observed Clu for 1.5 seconds during pursuit, then fade over 0.8 seconds. Losing sight stops beam tracking of hidden movement. Pause freezes projector motion; destruction/reset clears acquisition.

- [x] Correct spotlight reach for distant visible targets: scanning retains a 260 m throw, acquisition/tracking extends to the observed target within sensor range. Projector yaw/pitch rates reduced to 0.5/0.4 rad/s, with an 11-second scan cycle and bounded motion across goal changes. Aim compensates for the age of the last visible sample.

## Camera transitions and maze-tank awareness — September 16

- [x] V eases between driving and aerial views instead of resetting the camera. Aerial viewing direction follows turret azimuth; floor and fog blend with elevation. Wheel zoom and reduced-motion support remain available.
- [x] Ground tanks detect unobstructed Clu within 45 m from any direction and use turret direction as well as hull direction for distant sight. Nonfatal bullet impacts trigger a five-second investigation toward the incoming shot; this clue never reveals the hidden shooter position or permits firing/radio without visual confirmation.

- [x] Fix blueprint patrol stalls at corners: steering and pathfinding share swept clearance, waypoint advancement cannot cut blocked corners, and a valid route survives a failed replacement search. Radio updates trigger replanning; sightings too close to a wall receive a nearby clear approach point. Unreachable patrol destinations are replaced.

- [x] Stabilize Clu turret heading in every view and enemy turret heading during hull turns. Manual aim and stabilization share one yaw motor limit (Clu 1.2 rad/s; enemies 1.3 rad/s). Hull disturbances can cause temporary aim error, recovered at the capped rate; no instantaneous compensation. F remains an explicit hull-forward/level command.

### Mouse gunner aiming — September 16

P enters the gunner view; click to enable mouse-look (Escape releases and pauses). Mouse motion controls the viewing direction immediately at zoom-scaled sensitivity. A small central dot selects the nearest visible world/vehicle surface along the view ray; empty sky uses a distant fallback. The physical cannon aims from its muzzle toward that point using its existing accelerated, speed-limited motor. Film-style crosshairs show actual gun direction and converge on the desired dot. Shots always follow the physical barrel. This replaces the earlier desktop-cursor experiments.

F centers and levels, then locks to the hull until manual aiming. Driving, firing, zoom and view changes preserve that lock. J/L and I/K switch back to keyboard aiming. The barrel cannot aim below the tank base (the hull currently has yaw-only rotation). Mouse capture is optional and keyboard aiming remains available.

### Visibility and pursuit polish — September 16

The whole film gun sight follows the actual barrel as one unit. Enemy tanks have isolated materials with a restrained blue-gray body fill and red trim so low-angle views retain their silhouette. Clu's red tread trim eases into a 2 Hz emissive pulse during turbo and fades back afterward; reduced-motion mode uses steady glow. Enemy materials are independent of this effect.

Confirmed Recognizer spotlights now remain on through pursuit until the observed tank is within 120 m horizontally, then fade over 0.8 s. Loss of visual observation also fades the beam without following hidden movement. The former 1.5-second tracking timeout has been removed.

### Mouse tracking smoothness — September 16

The full sight now uses the same interpolated hull/turret pose and elevation as rendering, rather than stepping through raw 60 Hz states. Mouse tracking has an explicit normalized acceleration bound of 6/s and a 0.22-second proportional slowdown near its target. At 1× this limits mouse-command yaw acceleration to 7.2 rad/s² and pitch acceleration to 4.8 rad/s²; both scale with zoom. The shared physical yaw speed cap remains in place for hull compensation. Mechanical elevation stops still clamp at their limits.

Music now fades from the fatal hit through the 2.1-second destruction/terminal transition, reaching zero before playback pauses. Restart restores normal music gain. The fade follows transition progress, so pausing does not consume the remaining transition.

The end terminal plays the supplied “02 Only Solutions.mp3” after the gameplay track fades. Music has a separate output gain so terminal playback does not reactivate simulation sounds; mute still applies. Restart switches back to the opening recognition clip.

Opening music now uses the supplied “03 We've Got Company Clips/1 recognized 1.mp3”, once per new run without looping, replacing the full gameplay track. Only Solutions remains the end-terminal track.

### Action-driven music

Clip categories are discovered from MP3 filenames in `docs/assets/music/Tron/03 We've Got Company Clips` using a Vite glob. Recognized (also the existing spelling “recongized”), pursued, and gotcha are case-insensitive filename words. New files enter the development catalog automatically and the deployed catalog on the next build/deploy. No runtime server directory access is needed.

- Start each run with “1 recognized 1.mp3” once.
- Fresh confirmed visual contact selects a recognition cue; an already-playing recognition cue covers simultaneous sightings. Acquisition and radio-only reports do not trigger it.
- When a cue ends, choose a pursued cue if a live enemy is pursuing/attacking. Avoid immediate repeats when alternatives exist. Searching/investigating alone does not count.
- A pursuing Recognizer entering 100 m in 3D triggers gotcha; the encounter rearms beyond 140 m. Gotcha takes priority over new recognition cues while close.
- Action changes may interrupt a track: fade out over 0.45 s before changing source, then fade in over 0.3 s. Clips never loop; death cancels pending changes and fades the current level into the end terminal's Only Solutions track.

When pursuit ends without a replacement cue, music now fades to silence over 3 seconds (or the remaining clip duration if shorter). The final seconds of an unneeded clip also fade before its natural end. Reacquisition during this fade restores the current phrase smoothly. Cue-to-cue changes retain their quicker 0.45-second fade.

P now blends camera position, quaternion orientation and field of view over 0.75 seconds in both directions. The complete sight fades with the transition; the exterior tank is hidden as the camera enters its volume. The transition follows moving Clu, restarts from the current camera pose on reversal, and is skipped with reduced-motion preference.

The end terminal now retains the same blinking blue block cursor as the opening screen; reduced-motion preference keeps it steady.

The chase camera now keeps an independent smoothed position while gunner mode or its transition controls the displayed camera. This removes feedback from the blend into chase height/pitch correction on exit.

## Closer carrier and randomized patrols — September 16

The carrier route is nearer to Clu: forward offset is halved and left offset reduced from 9,000 to 3,000 meters. Two tanks escort it below, and two Recognizers follow flanking airborne slots. Air escorts use normal sight/radio rules to leave formation for contact, returning when their memory expires. The two opening pursuers remain separate.

Three maze tanks and one maze Recognizer receive fresh positions, headings and route seeds each game. Ground starts require wall clearance and mutual spacing. `createRun(seed)` reproduces a run for diagnostics; ordinary starts and resets generate a new seed. Stalled ground patrols choose a new destination after five seconds.

Tank destruction now uses a dedicated 1.65-second layered electronic explosion for CLU and enemy tanks, replacing the generic noise burst. Three synthesized variants combine a low shock, electrical rupture and scattered metallic debris; playback is spatial and distance-attenuated. A sample is available in the sound library.

Gunner magnification changes now ease over 0.35 seconds, including cycling from 8× back to 1×; repeated zoom input starts from the current interpolated field of view. Reduced-motion mode changes immediately. The larger magnification label sits in the top-center gap of the crosshair frame and follows the complete sight when aiming.

The gunner view also accepts mouse-wheel zoom: up zooms in, down zooms out, clamped at 1× and 8×. Trackpad input accumulates with a small threshold and rate limit to avoid racing through levels; O still cycles. Aerial wheel controls are unchanged.

The gunner camera is now anchored at the turret pivot instead of the muzzle. Independent mouse-look no longer moves sideways as the barrel catches up, removing motor-driven camera sway and its changing raycast origin. Turret speed/acceleration limits and muzzle-based projectile aiming remain unchanged.

CLU turret motion now has a quiet, low-pitched servo tone that follows actual yaw/elevation motor speed, including centering and stabilization. It fades on stopping, pause or destruction, and is spatialized at the tank. Following listening feedback, its gain is 0.032 and fundamental pitch spans 55–110 Hz.

CLU has a small HEALTH bar below turbo, also visible in gunner mode. Missing health regenerates continuously at 1% of maximum every three simulation seconds (five minutes for a full bar). Pause freezes recharge; destruction sets health to zero and cannot regenerate. Enemy health is unchanged.

Turbo now uses one label line, `T / TURBO`, with readiness shown by the bar alone and no countdown text. HEALTH has no visible percentage (its accessible meter value remains). Health turns orange at 50%, red at 25%, and pulses red at 10%; reduced-motion preference retains steady red.

Enemy bullet impacts now retain `lastHit` (part, simulation time, world x/y/s) and `partHits` counters. Hit events include `id` and `hitPart`; fatal destruction events carry the same classification. Recognizers distinguish crown, crossbar, shoulders and legs, including folded poses; tanks distinguish approximate turret/hull/track armor zones. This is collision-region tracking, not triangle picking. Existing damage and renderer nearest-surface breakup selection remain unchanged.

## Location-dependent enemy damage

Recognizer crown impacts are critical one-shot kills. Other body hits deal one health point; leg and tank-track hits deal half a point. Two hits to the same Recognizer leg permanently disable stomping; a committed attack aborts into climb/unfold recovery. Track efficiency drops to 65% after one hit and 25% after two; both tracks disabled immobilizes the hull while turret aiming and firing continue. Ground hull turn rate also decreases with track damage. Damaged tracks and disabled legs emit intermittent orange sparks. These effects persist until destruction/reset, and do not grant knowledge of unseen Clu. Tank turret classification now uses measured imported-model bounds transformed with turret yaw; remaining armor zones are approximate.

Enemy tanks now fire every 3.4–4.2 seconds with per-shot seeded variation. Their rounds have elliptical spread up to ±1.2° horizontally and ±0.6° vertically. Leading, visibility and range rules remain; the perturbed trajectory is also checked for walls and friendly tanks before firing. Weapon randomness has a separate seed from patrol choices.

## Edge smoothing and gunner targeting — September 17

The HDR renderer retains 4-sample MSAA and adds SMAA before output conversion. Rendering uses 1.25–1.5× pixel density where the four-million-pixel supersampling budget allows; large windows retain at least native resolution. The existing render-scale control remains available. This improves edge smoothing without adding ray tracing.

Gunner mode outlines enemy tanks in soft cyan, with hidden edges suppressed. When a shot along the actual barrel should intersect a moving enemy, the central hash mark smoothly shrinks to half size, rotates 90 degrees over the same 220 ms, and glows yellow. It returns to normal on a predicted miss; the outer crosshairs remain green and all marks retain their shared aiming position. Targeting feedback uses no text. The prediction uses current linear velocity, projectile lifetime and maze occlusion, and shares the simulation's approximate part volumes. Future turns, acceleration or leg folding can invalidate the estimate. It does not steer shots.

The instruments feature is removed: no lower-left readout, H-key toggle or instruments control hint remains.

The top controls row separates hints with centered dots.

The R-key reset shortcut and its controls hint are removed. Development scenario tests use the existing development-only reset hook.

## Intact Recognizer explosions — September 17

Recognizers now burst into their 15 actual connected model blocks. Connectivity is computed across black surfaces and red trim before leg posing, replacing the six position-based regions that could cut through blocks. The struck block also remains whole. Each block receives randomized outward impulse, delay and tumbling before falling; original surface trim, flash and optical rings remain. No fracture shards or new cut seams are generated for Recognizers. Tank destruction retains its existing fracture effect.

## Data collection across maze sites — September 17

- Four maze sites: the original and three copies separated by roughly three maze lengths, with independently randomized rotations per page load. Layout remains stable across resets/hot reloads; beam locations and patrol starts are chosen anew for each run. Rendering, collision, line of sight, projectile blocking and routing share transformed wall geometry.
- Each site has one central red data beam, at a different local position with at least 20 m wall clearance. The column reaches beyond the camera far plane without a visible cap. Driving through its 7 m collection radius collects once, including fast swept crossings. No score panel or automatic ending is added.
- Collection triggers a short electronic confirmation and a 1.5 s shutdown: initial flare, expanding ground ring, narrowing shaft and an ascending pulse. State and visuals reset with a new run.
- Each maze has three ground patrol tanks and one Recognizer. The opening pursuit and carrier escorts remain separate. Patrols choose nearby destinations as they move, favor recently unexplored areas, avoid blocked routes and other tanks, and make short local escape decisions at awkward corners. Sight/radio information and pursuit rules remain shared across all units. No preset patrol circuit is used.
- Distant walls receive a gradual blue brightness lift beyond 350 m and reduced distant fog; nearby colors remain unchanged. The floor covers the expanded world.
- Recognizer blocks receive 3.6 times the prior horizontal blast impulse, retaining all 15 connected blocks and the existing downward acceleration.
- Nonfatal tank/Recognizer impacts use new layered pressure, electrical crack and descending synthetic tail, with three variations. Removed the old metallic resonators; tank impacts are shorter and pitched higher than Recognizer impacts. Stereo placement and distance attenuation remain.
- Tank projected shadows use a consistent opaque footprint and polygon depth offset, preventing overlapping transparent triangles from accumulating darkness and reducing floor depth fighting at long camera distances.

### Carrier surveillance — September 17

- [x] Two underside searchlights detect unobscured CLU beneath the carrier and turn smoothly toward him. They continue tracking while he remains visible and nearby.
- [x] Once a light is aligned and illuminated, report the observed position and velocity once per second to both enemy types within a horizontal circle centered on the carrier. The circle has one maze width diameter (half a maze width radius); delivery takes 0.45 seconds.
- [x] Wall occlusion stops new reports immediately and fades the lights. Existing reports preserve their original timestamps; destroyed CLU is no longer tracked.

### Data transfer and carrier drone — September 17

- [x] Adapt the vertical blue-white curtain in the supplied `Sark and MCP.mp4` at 53–54 seconds into 32 shafts around stationary CLU. Stop within the red beam to build the curtain over 1.2 seconds, hold for 2.5 seconds, and reverse over 1.2 seconds before collecting data and fading the red beam. Moving or destruction interrupts transfer; passing through no longer collects data.
- [x] Replace the carrier film loop with a steady synthesized 16-second machinery drone. Preserve the original `carrier-rumble.wav` in the sound library for future use. Retain positional attenuation and Doppler.

### Carrier escape shuttle — September 17

- [x] Inspect supplied four-angle stills and the 2:34–2:57 escape sequence; construct an open shell model with ribbed trays, upright end blades and a single green-paneled side wall.
- [x] Provide a standalone orbit/turntable studio at `shuttle.html`, six camera presets and GLB export. See [model notes](models/carrier-shuttle/index.html) for uncertain dimensions and hidden surfaces.

### Maze music and presentation — September 17

- [x] Use the four supplied Tower Music clips: exploration once per game; approaching a nearby hidden beam; spotting its base; entering the column. Close means within 120 m. Visibility checks the camera frustum and wall line of sight to the base, not the infinitely tall shaft. Cues advance once per beam without restarting when the camera turns; pursuit has priority. Entry remains latched during its fade-in so driving through still triggers it. New runs reset cue history.
- [x] Replace near-coplanar shadow depth tests with explicit opaque draw order: floor, flat tank shadows, then vehicles and maze walls. This preserves occlusion while eliminating floor-versus-shadow depth competition.
- [x] Remove the C rear-view shortcut and its hints. Append `END OF LINE` to the closing terminal and show a small fan tribute at the bottom of that screen only. End-screen timing remains unchanged, per the user's correction.

The closing tribute now uses the FilmTerminal face, uppercase lettering and left alignment with the main terminal text. It types at 50 characters/second after a half-second pause, ends with MADE TOGETHER, ACROSS THE INTERFACE. followed by END OF LINE, and leaves the cursor there. Reduced-motion mode shows the complete text immediately. Restart cancels and resets typing.

### Beam transfer revision — September 17

Stopping inside a red beam pauses propulsion and engine audio while aiming and firing remain available. The shortened 18-second entry cue accompanies a 16-second transfer: surrounding shafts assemble over three seconds, hold until second nine, then open over seven seconds. Health restores gradually throughout. The column blends red through white into permanent blue; returning to blue does not repeat healing or effects. Completion sends a 12-second spherical wave out to half a maze width in radius, destroying ground/air enemies on contact and removing 25 of the carrier's 100 health per wave. Carrier damage darkens its hull and briefly flashes it; a carrier breakup sequence is not implemented.

All closing text matches the opening terminal font size. Closing tribute text now types at roughly ten characters per second with random keystroke spacing and longer punctuation/paragraph pauses. Reduced-motion preference still displays it immediately.

The transfer surround uses sky-reaching shafts that switch on individually at full height around CLU, then switch off in reverse order after second nine. No downward growth or visible upper ends.

The closing tribute waits after ACROSS THE INTERFACE until the outro media element reaches its final five seconds. It then inserts a newline, switches the cursor to red, and types END OF LINE in red. Timing follows actual playback, including pauses; reduced motion preserves the music cue but displays the final phrase without per-character animation.

Recognizer projector speeds now distinguish scanning (0.5/0.4 rad/s yaw/pitch), visible acquisition (1.2/0.9) and confirmed tracking (1.8/1.2). This allows turbo cross-traffic to remain illuminated while preserving slower searching, bounded movement, observed-velocity prediction and wall occlusion.

The closing screen holds for three seconds before the tribute starts typing; the final red sign-off remains synchronized to the last five seconds of the outro.

At second nine, when the transfer ring starts opening, the entry cue fades into the user-supplied `5 afterglow.mp3`, played once. The afterglow survives beam completion and leaving the beam; new pursuit may still interrupt it using the usual music rules.

### Recognizer shadows — September 18

Recognizers now project their actual body and folding-leg silhouettes onto the ground, using the same light direction and floor-first rendering as tank shadows. Shadows follow flight height and pose and disappear with the destroyed craft. They are excluded from breakup geometry and share the source geometry. This is a ground-plane projection, not shadow mapping onto roofs or vehicles.

### September 18 follow-up

Recognizers and breakup pieces now use a compact light-space shadow atlas to darken the maze walls, roofs, seams and floor. Debris shadows follow tumbling pieces and fade with their lifetime. Existing tank and Recognizer projected silhouettes remain on the ground. The atlas supports five simultaneous breakup groups, matching the existing debris lifetime cap. The shuttle studio and export now interpret the ribbed shell as an underside, with upward-looking cameras and illumination from below.

The outro never loops. Once the red END OF LINE finishes, the terminal fades to black over five seconds and returns to the opening screen without starting a new game automatically.

### September 18 combat and shadow corrections

- Five pursuers start spread behind CLU; each maze retains its own patrol and the carrier retains its escorts.
- Recognizer central core hits (crossbar and crown) destroy it in one shot. Shoulder/leg armor retains its existing damage behavior. Any bullet hit destroys an enemy tank.
- Gunner controls are keyboard-only for now: mouse aiming, clicking and wheel zoom are disabled in this view. O cycles 2× → 4× → 8× → 2×; the former 1× FOV remains only as the sensitivity reference. Aerial wheel zoom is unchanged.
- Active transfer-ring shafts destroy touching Recognizers at any flight height. Shaft visibility and collision use the same timed sequence; blue/inactive rings cannot cause contact damage.
- Shadow atlas rectangles now use physical texture coordinates independently of the game's supersampling ratio. Actual debris also has crisp projected ground silhouettes. Maze floor shadows use exact projected geometry rather than the coarse shadow map; wall/roof receiving still uses static shadow maps.

Wall-shadow refinement: exact floor silhouettes now use a lighter blue-black fill. Maze shadows on roofs, walls and vehicle surfaces use 50% attenuation; CLU, enemy tanks, Recognizers and carrier materials receive the static maze maps. Emissive material light is preserved.

### Faster beam sequence and outside-view cannon spread — September 18

Ring engagement takes 1.5 seconds, holds for six seconds, then disengages over 3.5 seconds. The transfer/healing/color sequence completes in 11 seconds; afterglow begins with ring opening at 7.5 seconds. The expanding damage sphere reaches its unchanged final radius in four seconds, three times its previous speed.

Outside gunner view, CLU shots have up to 0.6 degrees of horizontal and 0.3 degrees of vertical spread around their assisted trajectory. Level shots have no vertical spread, and all outside-view trajectories are clamped to the horizon or above to avoid floor strikes. Gunner shots remain precise. Spread is reproducible for a given run seed and shot sequence.

### Carrier shadows and wall self-shadow correction — September 18

Sark's carrier casts a moving, crisp hull silhouette onto the floor and a separate 1024-pixel shadow map onto maze walls and vehicles. Emissive vehicle trim stays lit. Only armor casts, avoiding redundant painted outlines and beacon meshes. The carrier atlas uses one tile; the static maze atlas remains cached after its first render. Slope-aware depth bias on maze/carrier receivers suppresses triangular self-shadow artifacts on bevelled wall faces without changing the exact floor silhouettes.

### Sentence-by-sentence closing tribute — September 18

The replacement tribute types three sentence cards at the same position. Each holds for three seconds, fades over 0.8 seconds, then clears before the next sentence. The initial three-second delay and human typing cadence remain. Reduced motion shows each sentence without typing/fading, retaining readable holds. The last sentence stays visible through the outro; the cursor waits beneath it for the song's final five seconds. The first character of the red END OF LINE sign-off triggers the supplied MCP dialog once; reset stops it and the sound toggle mutes it. The existing five-second final fade follows the completed sign-off.

### Clean screenshot export — September 18

F9 captures a PNG of the rendered scene during gameplay, the opening zoom, or pause. DOM overlays (including the guide, turbo, health, and gunner reticle) are excluded from the image. The HUD hides temporarily and restores after saving or cancellation. Browsers supporting the File System Access save picker let the user select a destination; other browsers download a timestamped Space-Paranoids PNG using their configured download behavior. Capturing renders immediately before reading the WebGL canvas, avoiding cleared/blank screenshots without permanently preserving the drawing buffer.

Wall shadow follow-up: the slope bias now covers the combined X/Y depth change of diagonal PCF samples, rather than just the larger axis. Matched close-up captures with shadows on/off isolate the previous triangular pattern and verify continuous shading after the correction.

### Drifting grid-cloud layer — September 18

The extracted cloud model is reused in a three-instance layer at 1,080 meters (three times the carrier altitude). All clouds drift along +X at 6 m/s across bounds enclosing all maze sites and the starting approach. Each cloud owns a separate Z lane with 700-meter edge margins, wider than its maximum half-extent, so their footprints cannot overlap even at a wrap. Each crossing deterministically varies its position within that lane and its size using the run seed. All clouds share one fixed orientation: their long axes and grid lines align with world +X and the ground grid, matching their shared direction of travel. Whole clouds fade to zero at map boundaries before wrapping to the opposite edge; distant clouds also fade between 4 and 6.5 km. Sky-only far-plane handling preserves distant visibility without changing the ground camera clipping. The single instanced mesh has no collision, shadow, sensor, or gameplay participation. Simulation time controls motion so pause and reset remain stable.

### Glyph-aligned CRT raster — September 18

Opening and closing terminal text now use the local Interface Raster color font derived from VT323. Dimmed raster bands are embedded in each glyph, with blue/red palettes, instead of a separate fixed screen-space mask. Bands retain 68% brightness rather than cutting transparent gaps. Credits use the same raster treatment, and the sign-off and cursor stay red. Existing typing, sentence replacement, final-line hold, and outro timing remain in place.

### Beam-base stability and grid-preserving carrier shadow — September 18

The beam base and expanding ground ring render in the floor-decoration pass, after the floor/shadows and before solid vehicles/walls. Their additive blending stays intact without an almost-coplanar floor depth comparison. The surrounding shafts and their contact damage are centered on the main beam, independent of CLU's stopping offset.

The carrier now shades the original floor material through its shadow atlas instead of painting a solid floor silhouette. Grid lines remain visible inside the shadow. Shader cache keys preserve each receiver's pre-existing material customizations when stacking shadow hooks.

### Directional blue horizon — September 18

A fixed world-space sunrise glow faces CLU's initial heading: blue haze fades upward, with a narrow violet accent at the horizon and a smooth angular falloff to darkness toward the sides/rear. A single background shader reconstructs world viewing rays, so the effect follows camera orientation without moving with the player or appearing as a nearby object. Existing floor, fog, and vehicle lighting remain unchanged. The terminal/reference studio hides the effect; scene disposal releases its geometry/material normally.

### Debris collisions and revised tribute — September 18

- [x] Give each intact Recognizer block and tank fragment an oriented box collider. Resolve floor, wall sides and roof contacts against nearby shared maze prisms, with bounded short steps for fast explosions, bounce, friction and sleep after settling.
- [x] Limit debris to five bursts / 160 pieces. Debris remains visual: it neither blocks vehicles nor collides with other debris. Existing fading, pause and disposal behavior remain.
- [x] Replace credits with the user's two-paragraph tribute, preserving explicit line breaks. Keep the collaboration paragraph visible through the outro and retain the red END OF LINE signoff.
- [x] Gently brighten the maze's blue-black wall faces and upright ledges for close-range readability.

### Rapier debris — September 18

- [x] Replace the provisional debris contact solver with Rapier rigid bodies, preserving the intact Recognizer blocks, existing blast velocities and per-vehicle gravity. Angular inertia and off-center contacts now produce natural tumbling, tipping and settling.
- [x] Use a fixed 120 Hz physics step with interpolated poses, continuous collision detection, sleeping bodies, nearby static maze prisms and the existing five-burst / 160-piece cap. Collision groups exclude debris/debris contacts and vehicles remain under their existing controls.

### Debris damage and shadow layering — September 18

- [x] Debris physically contacts CLU, enemy tanks, Recognizers and the carrier through coarse kinematic collision shapes. Damage uses the closing component of relative contact velocity, including spin, and estimated fragment mass (60 kg/m³): no damage below 5,000 J, then one health point per additional 50,000 J. Compound contacts are deduplicated; resting contacts cannot repeatedly damage a vehicle.
- [x] Run debris updates and apply damage during fixed gameplay steps. Fatal impacts use existing hit/destruction events, allowing subsequent explosions. Vehicle driving remains independently controlled.
- [x] Draw maze floor shadows before vehicle/debris ground shadows. Increase wall-face brightness again and reduce maze shadow darkening from 50% to 40%.
- [x] Update tribute wording to “FAN TRIBUTE GAME” and “LOVE AND GREAT APPRECIATION,” retaining the user's explicit line breaks and final collaboration paragraph.

Credits are authored in `docs/credits.txt` and imported as text by Vite. Explicit line breaks and blank-line paragraph changes are preserved; the timed red END OF LINE remains generated by the terminal sequence. Edit the text file to update the credits (rebuild for deployment).

- [x] Preserve the destroyed vehicle's full world velocity in each fragment's initial Rapier velocity, added to its explosion impulse. Sections with a delayed release continue translating at the vehicle velocity before detaching.

### Crisp shadows without triangle seams — September 18

- [x] Compare shadow depth against the receiver plane at the sampled texel center; handle tiny projected derivatives at distant coordinates. Use hard nearest-depth shadows rather than a nine-tap blur, with 512-pixel dynamic tiles.
- [x] Replace stochastic debris ground-shadow fading with a uniform minimum-blend fade. Overlapping projected triangles cannot accumulate darkness or reveal noisy/triangular fade patches; the established ground-shadow draw order is retained.

- [x] Use B as the displayed screenshot shortcut, retaining F9 as an alias for systems that deliver it to the browser. Brief save/cancel/download status makes capture feedback visible. The PNG remains canvas-only, without HUD or status overlays.

### Roof-edge self-shadow suppression — September 18

- [x] Give each slab and its decorative receivers a stable identity. Maze depth maps encode slab identity alongside depth; a slab ignores its own depth-map shadow, avoiding roof-edge sawtooth artifacts. Other slabs and vehicles still receive its shadows. This also suppresses self-occlusion within a single concave slab; inter-slab shadowing remains.
- [ ] Visually verify the roof-edge fix in-browser. Added `tests/roof-edge-shadows.mjs` for closed roof/wall corners and identities above 255; current execution permissions prevent launching the browser test.

Browser-launch follow-up: the roof-edge test now defaults to port 5173 and accepts `TRON_URL`. Both desktop Chrome and the matching Playwright headless shell fail before loading a page in the current restricted session; the headless shell explicitly reports macOS Mach service registration permission denied. Browser verification remains pending; run `node tests/roof-edge-shadows.mjs` from a normal Terminal with Vite running.


### Grid-preserving maze shadows — September 19

- [x] Shade the existing floor material with the cached maze shadow atlas instead of drawing opaque projected polygons. Grid lines remain visible under wall shadows, using the same material-shading approach as the carrier. Maze attenuation remains 40%, and vehicle/debris ground shadows still draw after the floor.
- [x] Verify grid visibility and tank-shadow layering in Chrome and complete a production build. The floor now shares the 1024-pixel-per-site map; unlike the former exact projected polygons, close-up floor edges have finite texel resolution.

Browser permission follow-up: the approved Chrome launch succeeded and `tests/roof-edge-shadows.mjs` passed all 30 closed-box poses with zero self-shadowed pixels. This supersedes the launch blocker above; exact visual matching to the user's roof-edge screenshot remains separate.


### Throttle-controlled turbo and crisp grid shadows — September 19

- [x] Turbo only raises speed and acceleration limits (both multipliers 2.5). Activation no longer changes velocity or supplies throttle. Forward/reverse input, coasting and braking retain control; duration, recharge and the existing reverse limit remain unchanged.
- [x] Replace the coarse maze floor-map edge with exact projected slab geometry. Multiply the existing floor color to preserve grid lines, using stencil bit 0 to darken each covered sample only once. Enable stencil attachments on the game renderer and multisampled scene target. Vehicle/debris shadows still draw afterward; wall/roof receiving retains the cached atlas.

This supersedes the finite-resolution floor-edge compromise in the preceding entry. Rendered blueprint and full-game captures were inspected, including grid retention and a clean diagonal floor-shadow boundary.


### Recognizer inertia and wall-shadow filtering — September 19

- [x] Persist yaw velocity with a 0.8 rad/s² acceleration/braking limit and retain the 0.62 rad/s turning limit. Heading changes, yielding, acquisition and attacks now decelerate rotation instead of freezing it. Horizontal forward thrust and drag remain momentum-based.
- [x] Persist vertical velocity with 14 m/s² controlled lift acceleration and a 22 m/s requested lift-speed limit. Hover changes, folding, recovery and aborted drops retain velocity. A drop uses its incoming vertical velocity and gravity; ground contact is the physical stop. Recovery completion uses small position/velocity tolerances rather than snapping to altitude.
- [x] Expose Recognizer turning and lift limits with units in the development tuning panel, including reset/export.
- [x] Increase the cached maze wall/roof atlas to 2048 pixels per site and add nine-sample, continuously weighted edge filtering. Each sample keeps receiver-plane depth correction and slab-identity exclusion. Dynamic aircraft/carrier maps retain their existing nearest-depth behavior; exact grid-preserving floor silhouettes remain separate.

Wall edges are now softened over a small texel neighborhood instead of making a binary step. This is still a finite-resolution shadow map, with greater texture memory than the former 1024-pixel maps, not exact geometric wall-on-wall shadowing. Human review of Recognizer weight and close wall edges remains appropriate.


### Exact wall-on-wall shadows and isolated development — September 19

- [x] Replace the softened maze wall/roof map with exact static geometry: clip each receiving triangle against caster triangles extruded along the fixed light direction. A light-plane spatial hash bounds the setup work; stencil bit 1 makes overlapping polygons a single shadow. Receiver slab identity still suppresses self-shadowing. Small depth bias keeps clipped polygons on their receivers, behind occluding vehicles. This supersedes the filtered wall-edge approach above.
- [x] Retain exact grid-preserving floor silhouettes. The initial WebGL context now explicitly requests stencil, as does the multisampled scene target. Moving vehicles still receive a separate cached 1024-pixel maze atlas.
- [x] Add an isolated Docker launcher with TRON as the only host-folder bind mount, separate Linux dependency/home volumes, an unprivileged user, read-only image filesystem, private IPC and no Docker socket. Codex approvals are disabled only inside that external boundary. Native Chrome remains the browser-test default; the container uses bundled Chromium.

Use `scripts/codex-container login` once, then `scripts/codex-container` for future container sessions. Current native session credentials/history are not mounted or copied. See README for build, test, port and authentication details.

- [x] Default Vite to manual refresh (`server.hmr: false`) so source edits do not interrupt play. `TRON_HMR=1 npm run dev` opts into automatic reload. Browser verification confirms a source edit preserves the running page and a manual refresh loads the update.
- [x] Verify exact wall edges against independent ray/box intersections and inspect the authored-maze capture. User confirms the wall shadows look right after this change.

September 20 teleporter flyover check: added a fixed-step moving-Recognizer regression at pursuit speed, with multiple headings and high altitude. All seven teleporter checks pass. Full-containment activation is unchanged: a 23.4 m wide aircraft has only 4.3 m of lateral center tolerance on an axis-aligned 32 m pad. A visually overlapping edge pass or an occupied destination can therefore produce no transfer; the reported flyover has not been reproduced as a trigger defect.
