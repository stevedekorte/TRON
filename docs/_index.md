---
title: Implementation plan
topTitle: TRON
subtitle: Current simulation scope, decisions, and acceptance criteria
---

## Project documents

<div class="card-grid cols-2">
<a class="card" href="assets/index.html"><h3>Assets</h3><p>Models, sounds, dependencies and source credits.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="models/index.html"><h3>Models</h3><p>Imported tank and Recognizer files, scales and material adapters.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="references/index.html"><h3>References</h3><p>Film stills and visual targets for the maze and vehicles.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="sounds/index.html"><h3>Sound library</h3><p>Listen to sound candidates, compare current effects, and browse future resources.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="refactoring/index.html"><h3>Refactoring design</h3><p>Code review, object ownership and an incremental cleanup plan.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="validation/index.html"><h3>Validation</h3><p>Browser checks, measured results and remaining review.</p><span class="arrow">View &rarr;</span></a>
<a class="card" href="history/index.html"><h3>History</h3><p>Original milestones, earlier plans, and development notes.</p><span class="arrow">View &rarr;</span></a>
</div>

## Light cycle arena asset preparation — September 23

- [x] Isolate Daniel Preti’s arena architecture from the supplied OBJ; preserve source scale and retain original files.
- [x] Add a runtime film-reference edge treatment: near-black walls with blue-gray outlines and deep purple symbols with violet borders. Inspect the Chrome preview; retain original model materials in the GLB.
- [x] Remove the dense modeled floor and render a separate white-on-black procedural grid with the existing game grid spacing, antialiasing and fade. Use this in both the arena preview and the game.
- [x] Reload the 447 KB, 8,349-triangle standalone GLB in Chrome and inspect rendered overview/interior captures. Geometry excludes the original floor tiles, bikes, trails and exterior scenery.

## Cycle trail and lighting follow-up — September 24

- [x] Give opaque trails 18 cm thickness, a grounded curved recess around the rear wheel (with tire clearance, not an axle-height taper), brighter blue, periodic vertical bands and highlighted edges.
- [x] Keep a destroyed cycle's barrier for three seconds, flash and settle over 0.24 seconds, then lower it to zero over 0.7 seconds. Release only that cycle's collision cells when the trail disappears.
- [x] Keep sharp right-angle turns independent of the decorative floor grid. Remove the floating arena scoreboard; matches continue internally.
- [x] Repair duplicate/quantized model surfaces, preserve authored smooth normals, and replace cracked hub caps with smooth geometry at measured source dimensions.
- [x] Add a compact shadow tile per cycle for self-shadowing and reduce ambient wash on cycle materials. Dispose the atlas with the arena scene.

## Arena visual refinements and uninterrupted inspection — September 24

- [x] Make trail walls fully opaque with saturated amber/deep-blue bodies, a soft vertical gradient and a pale flare behind each bike. Match their height to the bike body (1.5 m). Interpolate and trim trail ends to the rear of each bike; brightness follows distance along the trail through corners.
- [x] Darken the blue bike's painted body and trim while retaining white/silver components and original source materials in the GLB.
- [x] Double arena grid-line width, reduce cell spacing by 10% to 4.32 m, and add a subtle navy floor tint. Cycle movement uses independent 4.8 m decision lanes so turns need not coincide with the 4.32 m floor grid.
- [x] While free-camera inspection is active, protect Clu from bullets, stomps and debris damage and suppress end-screen transitions. Leaving inspection restores damage; restart clears inspection. This keeps running spectator matches from being interrupted by Clu's off-camera death.

## Light-cycle competition and arena patrol — September 24

- [x] Extract gold, blue and red bikes into standalone GLBs; use gold and blue for two teams of three inside the arena. Separate authored dimensions, simulation and rendering. Use 3.6 m bikes at 38.4 m/s on independent movement lanes.
- [x] Use deterministic local steering with bounded free-space search, forward clearance, friendly-lane avoidance and opponent interception. All bikes share the arena map and visible trail occupancy; this race does not call JEV.
- [x] Resolve each grid crossing simultaneously. Arena bounds, own trails, friendly trails and opposing trails eliminate bikes; head-on same-cell collisions eliminate both. Trails persist until the round resets. Last surviving team wins; after two minutes compare survivors, otherwise draw. Keep team scores, a three-second starting countdown and six-second result interval.
- [x] Render imported bikes, team-colored trail walls and crash flashes. Cap trail geometry by maximum round travel. The race uses the fixed simulation timestep and resets with the game.
- [x] Add one Recognizer circling above the arena wall with original flight dynamics. Sightings, radio contact and audible threats interrupt patrol; stale target knowledge returns it to the perimeter. The routing works in classic/local/JEV modes without querying JEV for routine patrol.
- [x] In free-camera mode, Space runs/pauses the world while retaining camera control; camera keys do not drive or fire Clu. C/Home/Space provides a quick way to watch the arena.
- [x] Enemy tanks clone Clu's colors and materials without the former enemy recoloring; materials remain independently owned.
- Race obstacles and participants are confined to their own simulation: cycles do not fight Clu or become Recognizer targets yet. Source texture limitation is recorded in Models. Browser captures establish initial rendering; human play and Safari review remain pending.

## Loading terminal — September 24

- [x] Show a static LOADING... terminal before application initialization; keep the access terminal and start controls hidden until assets, physics, scene setup, and the first rendered frame are ready. Initial HTML supplies the loading text, with the shared terminal typography and ENCOM logo. Three fixed-position dots appear successively on a 1.8-second CSS opacity cycle; reduced-motion preferences show static dots. This is an activity indicator, not measured progress.

## Arena placement and inspection camera — September 23

- [x] Make the light-cycle floor grid five times denser (4.8 m cells), scale its line width down proportionally, and dim the lines. Preserve subpixel line coverage so distant grid lines do not expand into a glowing field.

- [x] Place the arena east of the central labyrinth, grid-aligned with a narrow gap; avoid overlap with maze bounds for alternate layout seeds. Retain the imported scale, colored wall outlines, and white-on-black floor.
- [x] Cut the arena footprint out of the main ground shader to remove overlapping floor surfaces. Add a continuous exterior enclosure behind the imported decorated inner walls, using the same near-black surface color and blue-gray edge outlines.
- [x] C toggles a free inspection camera during play or pause. Freeze simulation and JEV planning while inspecting; restore the previous running/paused state on exit. WASD moves, Q/E descends/ascends, drag or arrow keys looks, Shift moves faster, Home frames the arena, C/Escape returns to Clu.
- [x] Chrome browser regression verifies startup, arena loading, camera movement with frozen simulation, and restoring both running and paused states. Inspect the rendered arena/labyrinth overview. Production build passes.
- Arena architecture is scenery to Clu and the main-world enemies; their wall collision and arena entrances are not yet implemented. The separate light-cycle race enforces its own arena bounds and solid trails. Safari visual review remains pending.

## Current direction — open-ended simulation

### Central labyrinth placement and population — September 23

- [x] Fix its beam to the measured center of the blueprint’s circular courtyard (pixel 724, 514), instead of choosing a random central navigation cell.
- [x] Scatter eight tanks and six Recognizers among interior annular sectors. Tank spawns must have a swept-clear route to the courtyard; other mazes retain their existing population.
- [x] Separate clipped wall-shadow decals from their receivers by 0.02 m before float32 upload, retaining depth testing and stencil union. This prevents coplanar rounding artifacts without softening the shadow edges.

### Central labyrinth — September 23

- [x] Trace the supplied Big labyrinth image into 116 wall islands, preserving the circular courtyard and three enclosed openings. Share polygon extrusion/collision code with the original blueprint maze, including hole-aware roof triangulation.
- [x] Add the labyrinth as a fifth, grid-aligned site at the center of the four existing mazes. Use 2.4 meters per image pixel and the existing 54-meter wall height. The default layout fits without moving the outer sites; placement can move overlapping sites outward if needed.
- [x] Include a fifth beam, four transport pads and normal maze patrols. Keep authored/reference fixtures unchanged. Verify collision/roof agreement, separation across four layout seeds, courtyard route accessibility, game startup and rendered geometry.

### Smarter stomps with original motion — September 23

- [x] Preserve the earlier film-like movement: thrust 24.2 m/s², yaw cap 0.62 rad/s, yaw acceleration 0.8 rad/s², ordinary drag/braking, 1.3-second fold, and 85 m/s² powered stomp descent. Remove all close-attack performance overrides. Cruise/max speeds are unchanged.
- [x] Improve decisions rather than physics: approach overhead before descending, retain a progressing attack lead, align for nearby walls, and allow a healthy pursuing lead to take a safe attack opportunity.
- [x] Brake as soon as the predicted stopping path provides a valid stomp, rather than insisting on an exact waypoint or redundant final heading. Keep fresh personal sight, cooldown, drift prediction and swept wall clearance checks.
- [x] Stomp drop/landing contact with debris cannot damage the attacker; normal flight and weapon hits remain vulnerable.
- [x] Double horizontal cannon scatter: Clu ±1.2°, enemies ±2.4°. Level aim has zero vertical scatter; gunner shots remain exact. Deliberate vertical auto-aim to airborne targets is retained.
- The user’s motion-fidelity correction supersedes both the universal four-second stomp deadline and the subsequent three-second full-rotation tuning. Regression cases check successful attacks from eight headings without exceeding original thrust/yaw limits, not an artificial deadline.

### Pursuit attacks and JEV toggle — September 23

- [x] Healthy lead Recognizers may commit a safe stomp while pursuing, without requiring JEV to select a separate strike maneuver. Pursuit endpoints use the wall-aligned landing pose; fresh sight, cooldown, support assignment, braking drift and full descent clearance remain mandatory.
- [x] N toggles JEV/local tactical control during play or pause without restarting. The stats box displays ON/OFF. Disabling JEV disengages autoplay; U enables JEV when starting autoplay. Mode preference persists.
- [x] Verify simulated JEV pursuit responses in a tight oblique corridor and a two-Recognizer encounter, plus Chrome keyboard/autoplay behavior. Full simulation suite: 260 passed. Live provider choices and actual play remain subject to review.

### Progress-aware attack leadership — September 23

- [x] Renew the lead recognizer’s twelve-second assignment after at least five meters of combined closing/descent progress. Do not rotate a progressing attacker out midway through its approach; retain blocked/dead/ineligible handoff and expiry for stalled attackers.
- [x] Reproduce two aircraft approaching stationary Clu from opposite sides at 120 m: previously no stomp in 120 seconds; corrected local control completes the stomp in approximately 24.27 seconds with one consistent lead. Keep one active strike at a time.

### Victory, surface impacts and attack support — September 23

- [x] Add the explicitly requested win condition: complete every data beam, freeze the round, fade to the terminal and print `docs/victory.txt` continuously at 45 characters/second. This supersedes the earlier no-win-screen direction for this condition only; empty beam lists do not win.
- [x] Drive victory printing from monotonic elapsed time rather than the capped simulation delta; reveal at most one character per frame as an immutable glyph element inside stable line nodes (no catch-up word bursts or DOM geometry/computed-style measurements) and skip hidden 3D rendering on the victory page.
- [x] Use the victory typography size (`min(1.5vw, 2.15vh)`, 1.12 line height) across opening, death, victory and credits text, without content-dependent sizing.
- [x] Add temporary Shift+8 victory preview for end-screen review (also available while paused).
- [x] Leave the victory page visible until Return; then play the existing credits text/music without the detachment message. Preserve death behavior and clean restart.
- [x] Reuse the optical double-ring burst for projectile wall/floor contacts and visible vehicle armor. Orient effects to surface normals with an 8 cm offset, retain depth testing, cap active effects, freeze them on pause and dispose them on expiry/reset.
- [x] Retain recognizer support assignments outside the old 140 m recruitment radius and when support units lose personal sight. Choose one lead attacker, one spotter and separated exit-cover positions using ground-connected map branches; use overhead slots where no branch is available. Cache formation goals until leadership/membership or recorded contact changes. Preserve radio limits, fresh target knowledge, wounded withdrawal and attack handoff.

### Teleporter border placement — September 22

- [x] Generate floor-shader pad borders from the active scenario’s maze sites, matching simulation placement. Remove the renderer’s use of the legacy authored-world pad constants. Include pad geometry in the shader cache key so different seeds/site counts cannot reuse stale positions.
- [x] Check all 52 pads across two blueprint seeds, an authored seed and a single-site authored layout. Preserve floor-integrated borders, grid-line thickness and horizon fading.

### Confined stomp positioning — September 23

- [x] Search nearby landing positions in sixteen directions at two radii and include exact local wall-edge headings. Keep the whole aircraft clear and reserve positional tolerance inside the existing crush trigger; do not widen the damage radius.
- [x] Settle strike approaches within 0.35 m and brake angular motion before committing to a descent. Preserve forward-only movement, collision checks, attack coordination, and fresh visual-contact requirements. This applies to Tactical/local and JEV maneuver execution; Classic behavior is unchanged.
- [x] Verify oblique narrow-corridor and close-wall poses, a complete collision-free corridor stomp, and the full simulation suite.

### Recognizer spotlight surface reach — September 23

- [x] Extend downward search/target beams to the floor using their current projector height and direction, including the ribbon width. Preserve wall clipping and sensing limits. Do not fade the final segment when a ray ends on a surface.
- [x] Check high-altitude ground/raised-surface endpoints and browser rendering, wall clipping, pause and state visibility.

### Wall-shadow depth stability — September 23

- [x] Increase the exact wall-overlay depth bias from slope/units −1/−1 to −2/−4. Independently rounded clipped vertices at distant maze coordinates could otherwise compete with the receiving wall and make patches flicker under tiny camera motion.
- [x] Verify 81 perspective camera poses across 0/4/10 km offsets, wall orientations and centimeter camera movement. Keep depth testing and stencil union, and preserve exact geometric edges.

### Carrier reveal panel and audio study — September 22

- [x] Use `Carrier derezed.mp4` at 2:37–2:38 to replace the carrier’s red rectangle with a softly feathered, translucent blue-white field and faint green rim. September 23 refinement: use a yellow pulsing rim, retain 0.5 base gray opacity at the center, and fade the gray fill to zero before it meets the rim. Add a 7 Hz pulse limited to 22% opacity variation, driven by simulation time so pause/reset remain stable.
- [x] Extract 2:38.5–2:40 (the second half of the initial clip) as a stereo WAV and prepare a 120 ms crossfaded loop candidate. Record source hash, timing and filters in `public/audio/carrier-derez-source.json`; add both to the sound library for audition.
- [ ] Audition the mixed-soundtrack excerpt/loop before choosing gameplay playback. No claim of isolated SFX or auditory approval; not yet loaded by the game.

### Solar Sailer transit and carrier arrival — September 22

- [x] Import the user-supplied JIHS Solar Sailer DAE locally as GLB with all seven textures. Preserve proportions at uniform 2.5× scale; use the film clip `carrier and solar sailer.mp4` at 1:34–1:46 for direction, silver sails and amber beam.
- [x] Add a fixed horizontal +X lane parallel to the carrier, at 520 m altitude and 600 m lateral offset. Traverse 12 km at 280 m/s every 180 seconds, starting three minutes into the round; fade at the distant ends. The beam fades in during the three seconds preceding each pass and fades out over nine seconds afterward, remaining invisible between passes. Pause/restart follow simulation time. This is background scenery without combat or collision participation.
- [x] Replace the model’s short source beam with a 24 km amber beam split around the complete vehicle span; the sail end leads travel. Expose scale, altitude, speed and period in development tuning.
- [x] Materialize the carrier at round start using the existing opening-line/rectangle, one wireframe sweep and solid fade, driven by the carrier’s 22 m/s translation (about 57 seconds for the hull to emerge, then the two-second solid fade). Reveal the +X front before the rear through a rectangle fixed in world space; its local position cancels the carrier’s translation. Sweep along the carrier’s long X axis, include existing hull seam lines in the reveal, and fade its shadow with the solids. Repeat on restart without recreating effects. Carrier wireframe ignores ground fog so it stays red at sky distances; its linear color is tuned to (1.5, 0, 0) for a softer red glow rather than the original overbright orange cast; running lights and beacons become active as they cross the reveal plane, independently of the final armor fade.

### Local documentation styling — September 22

- [x] Embed the colvmn stylesheet during `npm run docs` generation so Safari local-file viewing does not require a sibling-folder CSS load. Keep upstream colvmn unchanged; author Markdown/JSON and regenerate HTML with the project wrapper.

### Wall rims and landing tactics — September 22

- [x] Prevent moving aircraft shadows from exposing sawtooth strips on self-shielded maze wall rims. Use the slab face orientation and caster identity; give decorative trim explicit surface normals. Keep foreign-wall occlusion and exposed roof shadows.
- [ ] Allow deliberate Recognizer landings as future tactical choices: block Clu’s path to give an ally a crush opportunity, or land to rest. Ground contact is not inherently a navigation failure; distinguish purposeful blocking/resting from getting stuck. No new landing maneuvers are implemented by this rendering fix.

### Pursuit frame pacing — September 22

- [x] Replace repeatedly sorted ground/air search frontiers with stable priority queues. Spread enemy ground route searches across ticks with a shared 192-node budget and 24-node round-robin slices; keep movement, sensing and collisions running every tick.
- [x] Admit one new tactical candidate set per simulation tick across aircraft and tanks. Preserve existing maneuvers while waiting, defer expensive search-map construction to admitted planning work, and precompute search candidate rankings.
- [x] Reject distant teleporter pads with a conservative radius check before building exact vehicle footprints. Verify exact overlap/containment behavior and lifecycle isolation.
- [x] Record a reproducible eight-unit pursuit profile and validate bounded work, fair route completion, destination replacement and independent round budgets.

### Maze tank pursuit — September 22

- [x] Require a swept exit route when choosing blueprint ground patrol spawns; free floor inside an enclosed blueprint pocket is not a valid spawn. Cache checks per world and hull radius.
- [x] Retain valid ground routes to stable destinations. When the ordinary pursuit search fails, try finer 8 m routing with a bounded larger search; permit wall-safe partial progress toward a recorded contact if the full destination remains unreachable.
- [x] Verify patrol exit routes and actual radio-directed movement in Classic, local and JEV modes without revealing hidden Clu state. Preserve original observation age and physical wall collision.

### Recognizer moving turns — September 22

- [x] Remove heading-alignment stops from Classic, tactical/JEV and carrier escort flight. Preserve forward-only thrust, positional/angular inertia and level attitude while turning in flight.
- [x] Limit approach speed by remaining distance and turn time to prevent orbiting nearby destinations. Carry speed through collinear tactical waypoints; retain braking for arrival, acquisition, deliberate holds and confined descent. Permit a settled attack from an already clear actual pose without waiting for redundant final yaw.
- [x] Check right-angle/reversing turns, multi-location search, wall-side clearance, coordinated stomps and browser momentum/pause/reset behavior.

### Aircraft shadow occlusion — September 22

- [x] Gate Recognizer, carrier and detached-part shadows against the existing static maze light-depth atlas. Preserve shadows on exposed roofs while preventing additional dark silhouettes on obscured wall faces and covered ground.
- [x] Apply the same visibility test to projected Recognizer/debris ground silhouettes and rebind it when reinforcement growth rebuilds the atlases. Verify pixel coverage, materialization and restart resource stability.

### Gravity, aerial zoom and attack coordination — September 22

- [x] Remove vertical damping from production debris; retain horizontal drag, angular damping and contact friction. Regression now measures actual production free-fall velocity/displacement for four seconds without disabling damping in the test.
- [x] Restore scroll-wheel aerial zoom through `CameraRig`; verify both running and paused operation.
- [x] Use one active-maze-width radio radius for enemy observations, neutralization, materialization awareness and tactical ally information. Preserve observation age/delivery delay and vertical-distance checks.
- [x] Reserve one attack lead among nearby aircraft with compatible recorded target knowledge. Retain that lead for a bounded twelve-second approach; supporters use separated 90 m flank positions and cannot initiate a stomp. Reassign on destruction, blocked approach, lost visual contact, injury/cooldown or lease expiration. Coordination uses radio-visible allies, never unseen live Clu coordinates.

### Carrier escorts and debris avoidance — September 22

- [x] Preserve carrier escort duty in Classic, local and JEV modes when no current target/sound investigation interrupts it. Air escorts match a moving carrier slot above roof clearance; ground escorts retain separate perimeter detours, then use a bounded catch-up speed (1.4× ordinary tank speed) to regain formation. Combat movement retains its existing speed cap.
- [x] Publish detached physical debris poses/velocities/bounds to the session. Player perception filters these by 160 m range and wall visibility; JEV receives up to 24 nearest observed pieces, never hidden wreckage.
- [x] Autoplay checks visible falling/crossing/settled debris every tick against a 2.5-second predicted path, including turbo and braking. It can brake or steer using normal inputs and wall clearance, independent of API latency. Manual input overrides remain intact; damage remains real.
- [x] Verify carrier rejoining after blueprint traversal, visibility isolation, turbo prediction, physics observation cleanup, and otherwise-lethal settled/falling debris encounters. Full suite: 232 passed; Chrome autoplay regression passed without provider calls. Prediction is approximate and cannot guarantee escape from unavoidable impacts.

### Refactoring roadmap — September 22

Design review: [Refactoring review and design](refactoring/index.html). The ownership refactor is implemented locally. Keep this checklist as the plan source; the linked review now records the implementation, compatibility boundaries and remaining human checks. No deployment was performed.

- [x] Review current world selection, simulation/control boundaries, application lifecycle, rendering/audio ownership, and JEV transport/accounting. Document composition-based OOP recommendations grounded in the code.
- [x] **0 — Baseline:** explicit blueprint/authored scenarios and seeds, failure captures and boundary contracts; preserve known unresolved third-maze navigation as a tracked defect.
- [x] **1 — World:** explicit scenario/world construction, including derived pads/beams/rosters, shared by browser and tests; support independently constructed worlds without browser globals.
- [x] **2 — Navigation:** extract route execution/cursor/arrival behavior from mission/JEV selection, preserve controller behavior and expose blocked/progress diagnostics.
- [x] **3 — Lifecycle:** compose application, session, loop, input and HUD owners; preserve fixed-step ordering and isolate debris physics from presentation ownership.
- [x] **4 — JEV:** separate typed transport, scheduling/application policy and shared protocol/cost contracts; preserve retry, quota, privacy and lifetime behavior.
- [x] **5 — Presentation:** extract camera coordination, then clarify effect/resource ownership with captures and lifecycle checks; retain current shader ordering.
- [x] **6 — Audio/cleanup:** isolate music and voice responsibilities, remove competing implementations and reconcile documentation; retain explicit default-world adapters for standalone fixtures.


Remaining acceptance work: Safari audio-unlock/listening and side-by-side visual review on the user’s hardware. Automated results are recorded in [Validation](validation/index.html); these checks do not establish artistic fidelity. The seeded replay captures three beams, then holds near 686 seconds; full multi-maze completion remains unresolved.

### Debris gravity and faster panels — September 22

- [x] Use shared Earth gravity (9.81 m/s²) for every detached vehicle part; remove the Recognizer-specific 14.7 m/s² override. Preserve inherited velocity, blast impulse, damping and collisions.
- [x] Divide only panel formation and retraction durations by three: 0.5 s closing, 11 s enclosed hold, approximately 1.167 s opening. Total transfer is approximately 12.667 s. Camera movement rates, blast settings and animation ordering are unchanged.

### Beam panels, timeout retries and request stats — September 22

- [x] Replace transfer shafts with 16 translucent blue polygon panels, bright vertical edges and 0.2 m corner gaps. Preserve sequential closing/opening, height, timing and disabled blast. Match Recognizer contact damage to panel segments.
- [x] Retry JEV timeouts twice (three consecutive attempts total), with 0.5/1 second minimum backoff and existing pacing. Continue local piloting during retries, reset the failure streak on a response, and disengage after exhaustion. Non-timeout errors/budgets still disengage immediately. Pause cancellation is not a timeout.
- [x] Display this round’s total player/enemy request attempts, rolling 10-second requests/sec and USD cost in a bordered box beneath the top-left U / autoplay control. Count retries, preserve totals across pause/autoplay toggles, reset for a new run. Reported billable input usage replaces conservative request estimates; prefix cost with ~ while estimates remain. This round’s display is separate from the persistent hourly relay budget.

### Pad horizon and carrier spotlights — September 22

- [x] Bound pad-border shader anti-aliasing footprint and fade unresolved pads instead of letting grazing floor derivatives expand red borders across the horizon. Keep borders on the floor surface.
- [x] Default `CARRIER.searchlightsEnabled` to false, clearing light tracking/illumination and stopping spotlight-derived radio reports. Recognizer spotlights remain independent.

### Post-transfer damage bubble disabled — September 22

- [x] Default `DATA_BEAM.blastEnabled` to false. Skip post-capture wave damage and hide its expanding sphere/ring. Keep capture, healing, color transition, camera sequence and transfer-shaft contact behavior. Retain the effect behind this flag for later re-enabling.

### Corner arrival stall — September 22

- [x] Reproduce a motionless stall at about 147 seconds after the first blueprint beam: waypoint distance about 0.5 m, next segment occluded, throttle and steer both zero.
- [x] Distinguish intermediate corners from final destinations. Keep steering to 2 cm at intermediate points and creep at up to 2 m/s within 2 m, instead of applying final-stop/steering dead zones. Preserve final beam stopping behavior.
- [x] Extend the actual-blueprint regression through departure and capture of a second beam, rejecting prolonged motionless/no-steering stalls between transfers.
- [ ] A longer exploratory run encountered a separate hold/route-failure near the third maze around 689 seconds. Full multi-maze completion remains unverified.

### Blueprint route correction — September 22

- [x] Reproduce hold at the enemy-free browser-default blueprint spawn. Prior autoplay simulation fixtures used the historic authored layout and missed this failure.
- [x] Search outward from the constrained beam destination using an 8 m grid and larger bounded search/detour allowance, then reverse the swept route for Clu. Keep coarse open-grid routing as fallback. Default enemy route-search settings remain unchanged.
- [x] Add permanent blueprint coverage asserting a collision-clear route from the actual spawn and capture of its local beam. Browser autoplay coverage now begins at the blueprint opening before the separate empty-grid control fixture.

### Post-combat autoplay — September 22

- [x] Distinguish visible contacts from maneuver threats: enemies within 100 m, or within 250 m approaching Clu faster than 2 m/s. Include both visible contacts and threat IDs in player snapshots; no private enemy pursuit state is read.
- [x] Replan immediately when threats appear/disappear, clear route-failure cooldowns on that transition, and reject delayed escape choices once threats are gone. Resume the beam mission after destroying pursuers.
- [x] While red beams remain and no threat is present, a missing route permits maze-entry recovery or hold/retry, never unrestricted open-grid exploration. Verify five destroyed pursuers, nonapproaching distant contacts and temporary route failure.

### Autoplay cornering and turbo — September 21

- [x] Preserve waypoint progress when JEV confirms the current option. Consume visible route waypoints continuously and brake/turn in place for sharp headings; approach occluded corners closely enough to see the next segment instead of stopping at the waypoint acceptance radius.
- [x] Prioritize uncollected beams within 2 km over previously selected distant destinations. Once local beams are blue, travel to the next maze remains intentional.
- [x] Activate turbo through normal simulation input only when aligned, moving, and a clear route segment exceeds the full boosted run plus braking distance. Regulate boosted speed; avoid automatic activation during manual driving overrides. Expose turbo cooldown and duration in player snapshots.

### Background autoplay — September 21

- [x] Keep autoplay running on window blur or hidden-tab transitions. Clear held manual inputs on focus loss. Preserve explicit pause and pause unattended play when autoplay is disabled or JEV fails.
- [x] Use one scheduled loop: animation frames while visible, a 250 ms timer while hidden. Retain fixed 60 Hz simulation steps with bounded one-second catch-up; skip hidden rendering. Cancel both scheduling paths on disposal. Browser/OS suspension can still reduce background progress.

### Autoplay beam navigation — September 21

- [x] Expose all beam colors with distance in meters and hull-relative bearing in radians (positive right), plus the active destination. Remove the 500 m objective cutoff.
- [x] Retain a selected uncollected beam across replans; advance when it becomes blue. Without visible enemies, offer the mission route rather than unrelated short wandering moves. Preserve combat maneuver options and hold during transfer.
- [x] Connect local swept maze routes with long open-grid legs around maze bounds; retain route waypoints across replans and recheck clearance. Retry failed objectives after a bounded delay. Verify two captures in different authored mazes during a 600-second enemy-free simulation. Full combat completion remains unverified.

### Local JEV request pacing — September 21

- [x] Pace local client calls at least 650 ms apart in wall time, including across restarts, to respect the relay’s 600 ms minimum. Distinguish busy, short-interval and hourly-cap warnings; include retry delays. These limits are independent of purchased provider credits. Replace the request-count allowance with a $1 USD rolling-hour local spend budget. Configure server-only `JEV_HOURLY_BUDGET_USD` in `.env.local`; restart Vite after changes. Persist reservations and settled usage in ignored `.local/jev-spend.json`. Public Worker quotas remain separate.

### Beam camera and persistent autoplay — September 21

- [x] Animate a presentation-only aerial rise and L-direction orbit during beam transfer, at half keyboard speed. Rise and descent each take 2.4 seconds; descent starts at 10.1 seconds and reaches Clu at 12.5 seconds as the ring opens. The beam continues its color transition during opening. Freeze with simulation pause, skip automatic motion for reduced-motion users, and allow V/P to cancel. Do not turn the weapon.
- [x] Keep autoplay selected until U or its HUD toggle is used, or JEV becomes unavailable. Service errors/timeouts/rate limits disengage the pilot and clear its plan; no automatic re-enabling after recovery. Retain the warning while off. Held driving/aim controls override their own channels, and Space/mouse fire combines with automatic firing without interrupting navigation. Release returns held channels to the pilot; existing cruise/aim-lock modes retain their normal behavior.
- [x] Verify camera timing/pause/return and persistent manual overrides in simulation and headless Chrome.

### Beam objective, longer hold and teleport audio — September 21

- [x] Make turning every red data beam blue explicit in the player Jev prompt and snapshot. Include remaining/total counts, red/transitioning/blue state, remaining transfer time and the stop-and-wait activation rules. Keep survival and the open-ended simulation; no win screen. Candidate routes remain bounded, so successful completion of all sites is not guaranteed.
- [x] Extend the closed ring hold from 6 to 11 seconds without changing the 1.5-second closing or 3.5-second opening sweeps. Total transfer is now 16 seconds. Visual color progress, healing and release use the same total; only the hold duration is extended.
- [x] Add original synthesized teleport audio: descending phase collapse and rising resonant reassembly, with a short digital snap and stereo echo. Trigger only on completed relocation. Nearby vehicles produce spatial cues at departure/arrival; Clu hears one continuous 0.78-second cue at arrival. Master mute/pause and reset cleanup apply. Source: `src/audio/teleport.js`.

### Autoplay driving continuity — September 21

- [x] Treat temporary route endpoints as handoffs: request a new feasible route before the braking zone, roll through straight intermediate waypoints, and skip already-passed waypoints after delayed decisions. Use a turn/distance speed target instead of an all-or-nothing angular throttle cutoff; retain braking at obstacles and data destinations.
- [x] Steer the turret toward the active visible target or along the driving route when there is no contact. Retain a tracked target across replans unless another is substantially nearer, to reduce camera swings. Keep the ordinary turret motor limits and temporary manual overrides.
- [x] Verify sustained cruising above 19 m/s after acceleration in a clear 20-second route, momentum through collinear waypoints, stopping at a data destination and reorienting a sideways turret. Browser/build validation is recorded in Validation.

### Optional Clu autoplay — September 21

- [x] Add an off-by-default U key and HUD button to let Jev choose Clu maneuvers. Keep the enemy AI mode independent. Movement/turret/fire input temporarily overrides the corresponding pilot controls; pause suspends requests and motion. Label Jev/local fallback on the button.
- [x] Supply Clu's own pose, health, heading/speed, nearby visible enemies, static walls/data destinations, recent positions and bounded feasible maneuver routes. Use a distinct server-owned player prompt. No hidden enemy positions, memories or tactical plans enter its snapshot. Local motor code steers/brakes and only fires through the existing observed target/aim-cone checks.
- [x] Share one serial Jev client, rate/cooldown budget and alternating player/enemy opportunities. Reject stale or pre-teleport replies; local tactics continue during failures. Check moving inputs, information isolation, selection, pause and temporary manual overrides. A live local-relay player request returned an accepted decision; encounter quality and long autonomous runs still need human review.

### In-game service warnings — September 21

- [x] Add a compact top-right warning area below the health/turbo meters, available in production as well as development. Show JEV OFF for deliberately selected Classic/local modes, JEV LIMIT for rate/budget failures, and JEV UNAVAILABLE for service/network failures. Explain the reason and continuing local AI. Keep warnings through pause, resets and retries until a successful response; normal idle/low-confidence decisions are not service failures. Allow other named warning/error notices to share this area, and announce changes politely to assistive technology.

### Public Jev hosting — September 21

- [x] Keep the game/assets on GitHub Pages and add a Cloudflare Worker for the fixed Jev decision contract, with a server-side secret and public build-time API URL. Preserve the local Vite relay.
- [x] Enforce body size, timeout, per-IP pacing and durable global daily request/input-byte limits before calling Jev; bound concurrency and honor Retry-After with local AI fallback. Anonymous access is intentional; CORS is not authentication and shared IPs share limits. See [Jev design](jev/index.html) and README for limits, disabling and deployment.
- [x] Verify quota persistence/rollover, concurrency, invalid requests/answers, secret isolation and client cooldown with Node tests; dry-run the Worker and check its SQLite budget in the actual local Cloudflare runtime.
- [x] Deploy the Worker and server-side secret; verify a real provider decision and the production build in headless Chrome at the public origin. Website publication uses its pinned TRON checkout and public API-base build setting.

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
- [x] Check provider browser access: CORS preflights from local origins are rejected, so direct browser calls are not viable in the tested setup. Keep the same-machine relay; initial real end-to-end calls measured 317 ms and 292 ms. This was initially a local-only service; the public Cloudflare relay above now supports static production clients.
- [x] Replan on sight loss/reacquisition, newly received or expired contact, an observed velocity change of at least 8 m/s, or target displacement of at least 45 m. These events bypass the normal commitment gate with a 0.65-second event cooldown. Preserve momentum and committed attack phases; reject Jev answers based on superseded observations/revisions. Healthy units actively follow the bounded last-known path, then inspect nearby branches instead of favoring passive ambush. Search hypotheses never become sightings or authorize blind attacks. Ground route refresh follows a new tactical plan.
- [ ] Human comparison of encounter quality, retreat behavior and longer Jev sessions. The planner is bounded and conservative, not a globally optimal flight/attack planner. A geometry-valid maneuver is not a guaranteed successful strike on a moving target; some narrow spaces remain inaccessible. Choosing better actions than the local policy remains an experimental question.

September 21 hearing: aircraft and ground enemies receive bounded, expiring acoustic observations for engines, cannon fire, impacts and explosions. Use distance attenuation, wall muffling and deterministic bearing/range error; never copy a sound into confirmed sighting memory. Unknown sounds permit local investigation and nearby Jev requests with `target: null`; friendly sounds are context only. Hearing is independent of player audio volume and pauses with simulation. Range controls are available in development tuning. See [Jev enemy control](jev/index.html#hearing-input) for the report format and limits.

September 21 connected-search follow-up: persist whether the last-known location has been checked, so moving into a branch cannot re-enable a return-to-origin maneuver. Build a bounded graph of tank-passable corridors from the predicted contact point (8 m steps, 160 m path budget, swept wall checks); use its reachable locations instead of nearby open cells across arbitrary walls. Retain completed checks for the search episode, advance both ground and air units on arrival, and share `search` progress plus each candidate's `searchPath` with Jev. Aircraft already above the roof search from above instead of descending at every checkpoint; feasible low search routes remain available to settled low aircraft. Regression checks cover an L-shaped route, disconnected pockets, continuous aircraft search and ground progression.

September 21 opening-pursuit correction: above-roof aircraft proceed toward the travel waypoint while turning/climbing, rather than returning to the route origin after inertial drift. Healthy units receive a pursuit/support maneuver and no longer prefer regrouping simply because allies are spread out. Reserve attack spacing only for a nearby strike or active stomp; retain local swept collision checks and knowledge-limited target prediction. A moving-opening regression requires all five pursuers to close distance and exceed Clu’s normal speed.

Design references: the [Tetris example](https://github.com/Yasserbhb/Agent-JEV-Tetris) measures reachable action outcomes and avoids conflicting directional hints; the [Doom example](https://github.com/lukaske/jev-doom-agent) uses structured observations, selected maneuvers and local motor control. This implementation is independently written; no external game code or assets were copied. API shape follows the [TypeSafe quick start](https://docs.typesafe.ai/introduction/quickstart).


September 21 grid alignment: maze-site origins now snap to the 24 m world grid, with seeded rotations restricted to 0°, 90°, 180° or 270°. The initial maze stays at the origin and unrotated. Rendering, collision, patrol locations, data beams and teleport pads derive from the same site transforms. Preserve the authored diagonal wall ends and blueprint shapes within each site.

### Spatial teleport pads — September 21 (supersedes the timed transfer)

- [x] Preserve four grid-aligned 48 m square borders outside each maze and their links to other sites. Extend each invisible portal volume from the floor to four maze-wall heights; aircraft above that volume do not transfer.
- [x] Clip vehicle solids and their shadows inside the volume, drawing glowing edge wireframe only on those portions. Partial entry/exit is spatial, independent of time. Clu, ground tanks, folding aircraft, turrets, projected floor shadows and aircraft depth-atlas shadows share the same clipping planes. No sweeping rectangle or fade is used for teleportation; reinforcement materialization remains unchanged.
- [x] On full conservative hull/turret/vertical containment, transfer instantly with the same local pad offset, altitude, heading, linear/angular motion, turbo and player controls. Continue driving normally while entering/leaving. Block an occupied destination without freezing the vehicle; process transfers atomically to avoid overlapping arrivals. Require complete 3D exit before rearming. Pulse the source/destination borders briefly; snap camera/interpolation history at transfer.
- [x] Replan arriving enemies and synchronize nearby recorded awareness immediately, without inventing live Clu coordinates. Vehicles remain subject to ordinary movement, visibility and weapon/collision rules during the spatial effect.
- [x] Verify partial/complete entry, turret and ceiling bounds, altitude exit, offset/momentum, occupied/simultaneous arrivals and awareness in simulation. Drive through in Chrome; inspect half-wireframe entry, full-wireframe arrival and solid exit, with paused simulation and no browser errors. Preserve separate reinforcement animation checks.

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

### Superseded turn-speed experiment — September 23

Historical experiment, now superseded by restoring original motion above: maximum yaw rate is 120°/s (one revolution per three seconds at full speed), with 240°/s² acceleration/braking and the normal smooth heading response. All flight uses the same limit, including close attacks. Close-attack speed reduces when a turn needs a tighter radius, avoiding repeated orbits. A turn from rest includes acceleration and settling time, so a backwards-facing attacker can exceed the four-second stomp target. Eight-heading tests verify bounded yaw rate/acceleration and successful stomps; aligned attacks retain the four-second check.

### Helicopter-style Recognizer translation — September 23

Recognizers can thrust sideways and backward independently of yaw, in local/JEV navigation, Classic navigation and carrier escort flight. The acceleration vector shares the original 24.2 m/s² budget across all directions (no diagonal bonus); drag, braking, speed caps and angular inertia remain unchanged. Tight-corridor planning includes lateral/reverse translations with swept hull clearance. A wall-aligned hull can slide into position without first turning broadside. Existing pursuit-to-stomp opportunity checks and support assignments remain active.

### ENCOM terminal signature — September 23

- [x] Add a local SVG ENCOM mark based on the supplied MCP terminal reference, with pale lavender glow at the lower right of the shared terminal overlay. Opening, detached/credits, victory and victory credits share the mark, and it fades with the opening transition. Typed text is unaffected.

### Lead and intercept approaching Clu — September 23

- [x] Choose a reachable crossing ahead of observed motion, accounting for approach, normal acceleration/braking, folding and fall time. Bounded prediction uses recorded position/velocity and stops at mapped obstructions.
- [x] Hold the chosen crossing while sightings follow the predicted path, instead of continually moving it farther ahead. Changed velocity, lost sight, injury or an expired interception still permits replanning. JEV candidate facts include approach time and predicted impact time.
- [x] Keep the lead's attack plan when only supporting positions change. Supporting units still refresh their own routes.
- [x] Preserve a useful wall-aligned facing during overhead translation. Start folding while Clu approaches; commitment still requires fresh personal sight and a physically clear descent, and a committed drop cannot track an evasive maneuver.
- All existing speeds, accelerations, fold/drop timing and health rules remain unchanged.
