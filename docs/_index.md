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

Turbo now uses one label line, `T / TURBO ✓` when ready, with no countdown text. HEALTH has no visible percentage (its accessible meter value remains). Health turns orange at 50%, red at 25%, and pulses red at 10%; reduced-motion preference retains steady red.
