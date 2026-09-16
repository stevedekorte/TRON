---
title: Validation
subtitle: Browser checks, performance, and remaining work
---

## Blueprint alternative — September 12

The optional `?maze=blueprint` layout hand-traces 20 roof islands from Maze Blue Print.png. A top-down reference preset and source/trace SVG overlay make the geometry reviewable. The existing authored maze remains the default.

- `npm test`: 16 checks pass. The three new checks verify triangulated area equals polygon area for all islands, concave notches and above-roof sight behavior, occupancy/ray agreement across thousands of sample points, a clear spawn/entry route, and clear AI search samples.
- `node tests/reference.mjs`: passes the original five comparison views, four documentation cards, the blueprint top-down/overlay render, and an eight-second drive into the traced maze. The tank enters at the cropped lower boundary, reaches a real wall without penetrating it, and all five aircraft remain present. No browser errors after correcting an integer-valued GLSL denominator in the new identity-axis layout.
- Visually inspected blueprint-overlay.png and blueprint-aerial.png against the supplied image. Coordinates follow roof boundaries rather than the image's small side shadows. No unseen wall continuation is implied.
- `npm run build`: succeeds and regenerates the trace overlay and five documentation pages. Blueprint geometry is bundled as local data, with no runtime need for the source image.

Scale (0.8 m/pixel), wall height (54 m), cropped-boundary closure and cosmetic ledge depths remain stated reconstruction choices. These checks do not establish an exact original-film layout.

## Renamed references and wall details — September 12

Updated the reference studio and documentation to the user's descriptive image filenames, including Maze Details.png. Added a fifth fixed camera for the new wall reference. Sparse blue-gray seams, tall panel outlines and shallow beveled ledges now follow exposed wall faces. These details are cosmetic; passage geometry and collision volumes are unchanged.

Validation: `npm run build` passed. `node tests/reference.mjs` passed all five rendered comparisons, verified reference images loaded, and checked the four documentation cards and destination pages. Inspected test-results/reference/details.png for the actual wall detailing. No browser errors.

## Fixed reference iteration and visibility — September 12 evening

Added a local reference studio at /reference.html with fixed front/rear tank, overhead maze and ground-level maze cameras, film images alongside the live renderer, and a reference overlay. Captured and visually inspected successive material, camera, floor and shadow passes.

The disappearing maze was a contrast regression: the walls and floor still rendered but became nearly black at driving height. Restored blue floor/wall separation. A view-height/grazing-angle wash keeps the ground readable during driving while preserving dark channels in overhead views. Maze geometry keeps the longer parallel branches and pointed diagonal ends the user preferred; no further topology changes were made after that feedback.

Tank red outlines are subdued and non-emissive. Blue highlights, dark lower side panels, gold upper shoulders, reduced insignia bloom and projected hull/turret shadows replace the earlier luminous trim and soft contact-only shadow. Imported geometry remains intact; its canopy and hull contours still differ from the film. The overview is an interpretation, not an exact traced map.

- `npm test`: all 13 checks pass. Wall fixtures now target a straight boundary section instead of a newly clipped corner; movement vectors derive from the oblique grid transform.
- `node tests/reference.mjs`: four reference views render without browser errors; all four documentation cards are present and their destinations return HTTP 200. Captures are in test-results/reference.
- `npm run test:browser`: Chrome 152.0.7977.84 passes actual maze entry/branch driving, level turret, shooting, visibility/memory, pause, aerial/survey and ten resets. 1440×900 sample: 44 geometries, 14 textures, 57 calls, median and 95th-percentile frame intervals about 16.7 ms. Inspected the final driving capture for visible walls and flooring.
- `npm run build`: succeeds; colvmn generates five documentation pages.
- Sandboxed Chrome launches aborted on this host and produced macOS crash dialogs. Subsequent launches explicitly used the required approved execution mode. One screenshot attempt timed out; the subsequent capture completed. This is not evidence that every host or browser is verified.

## Imported vehicles — September 12

Replaced both procedural vehicles with user-supplied GLBs: arabinowitz's tank and Shriker1's Recognizer. Inspected the actual rendered models together and the tank in the maze.

- `npm test`: all thirteen simulation checks pass after the muzzle coordinates changed.
- `node tests/models.mjs`: visible muzzle agrees with the simulated origin across nine hull/turret combinations (maximum error 3.7e-15 meters); Recognizer height is 15 meters, width 18.38 meters, and hit materials are independent per aircraft. Screenshot: test-results/imported-models.png.
- `npm run test:browser`: Chrome 152 passes controls, shooting/destruction, five agents, entry/branch driving, pause, map/aerial, ten resets and resize with no page/console errors. Sampled 1440×900 frame intervals: median 16.7 ms, 95th percentile 16.8 ms. Final renderer sample: 43 geometries, 14 textures, 52 draw calls.
- `npm run test:browser -- --lifecycle`: passes blur/input cleanup, mute, reduced motion/quality, context loss, unsupported WebGL, failed GLB loading/reload message, and production preview driving with no development hook.
- Production build includes both local GLBs; no external model host is contacted.
- Earlier 180-second traversal measurements below predate the imported vehicles. Safari remains unverified.

## Current simulation revision — September 12

The latest user direction replaces the timed chase with an open-ended simulation. Earlier route/capture/win evidence above is historical and does not describe current behavior.

The current maze is connected and branching, with loops, dead ends and four openings. Its topology is transformed onto oblique axes, and exposed slab tips are clipped diagonally. Shared convex prisms drive the roof/wall mesh, hull collision, projectile blocking, sight occlusion and camera clearance. This follows the supplied overhead frame's forms; the hidden layout is authored, not verified as the exact film maze.

Five Recognizers begin outside the maze and persist independently. They use a 370 m view range, approximately 148° horizontal field of view and 5 Hz sight sampling. Each stores its own observed position/velocity, time and source. Radio reports are delayed 0.45 seconds, range-limited to 560 m, and retain their original timestamp through relays. Prediction is capped at five seconds and stops at mapped walls; knowledge expires after 38 seconds. Navigation receives no live Clu state. Aircraft clear the roof physically and separate from one another; sound uses five spatial voices with wall muffling.

Recognizers are uniformly half the old scale: upright legs about 9 m (30 ft), total height about 15 m and shoulder width 17.5 m. Hit volumes and flight clearance use the same scale. This implements the user's estimate, not a canonical film measurement.

Checks completed so far:

- `npm test`: thirteen checks pass for connectivity/branches/cycles/dead ends, collision/sliding and pivot turns, roof and wall visibility, field of view, occlusion freezing memory, delayed radio copying/expiry, identical observer behavior under different unseen Clu locations, bounded prediction, level/manual gun azimuth with height assistance, wall-blocked shots, persistent agents and clean resets, fixed-step consistency, physically open diagonal cuts, and physical aircraft clearance during converging pursuit.
- `npm run test:browser`: Chrome 152.0.7977.84 passes five aircraft/audio sources, Q/E rotation and level barrel, actual entry and side-branch driving, pause freezing the aircraft, aerial/survey views, sighting/report memory, real projectile destruction, ten resets and resize. No page/console errors. At 1440×900, final sample: 243 uploaded geometries, 13 textures, 78 draw calls; approximately 16.7 ms median / 16.8 ms 95th-percentile frame intervals.
- Inspected actual browser screenshots of the entry, diagonal slabs and survey. A generated floor-shader constant initially used an integer where GLSL required a float; corrected and the full browser check rerun. The gun fixture now changes the live development settings through the existing module instance, avoiding a duplicate Vite import; projectile outcomes still use normal simulation collision.

The old structured-chase long-run report predates this revision. Current sustained traversal and production/lifecycle results are recorded below when completed. Human judgment of atmosphere, exact film matching and sound remains separate from these technical checks. External model acquisition was subsequently completed; see the imported-vehicles checks above.


The 180-second 1920×1080 traversal passed: 24 waypoints and approximately 1,299 meters through actual branches, no slab penetration, no page/console errors, and 242 uploaded geometries / 13 textures from the 60-second sample onward. Sampled frame intervals after warmup were about 16.7 ms median and 16.7–16.8 ms at the 95th percentile. Agents independently entered pursue/investigate states during the traversal. This run preceded the final aircraft-clearance adjustment; the resulting crowding seen from above was addressed with stronger avoidance and a 24-meter separation envelope. A focused 20-second convergence test passes after that adjustment.

`npm run test:browser -- --lifecycle` passed for blur/input cleanup, mute, lower quality, reduced camera motion, context-loss recovery, unsupported WebGL handling and production driving without development hooks. The production bundle and four colvmn pages build successfully; JavaScript is approximately 161 kB gzipped, with Vite's standard chunk-size advisory. Chrome is the tested browser; Safari/Firefox and subjective sound quality remain unverified for this revision.

The final browser smoke rerun also passed the converging-aircraft clearance scenario, real shooting and all previous control/reset checks, with zero page/console errors and approximately 16.7 ms median/95th-percentile frame intervals at 1440×900.

The final terminal check passed incremental typing, Enter skip/start, reduced-motion immediate reveal and the narrow-window layout. The narrow terminal screenshot was visually inspected.

## Historical validation reports

These entries describe earlier builds and are retained as a development record.


Date: 2026-09-12. This report distinguishes verified technical behavior from pending human playtesting and visual fidelity work.

## Environment

- MacBook Pro, Apple M2 Max, 96 GB RAM; macOS 26.6.2.
- Node 22.22.0; Three.js 0.186.0; Vite 8.3.0; Playwright 1.63.0.
- Chrome 152.0.7977.84, browser automation with actual WebGL rendering. Screenshots were opened and visually inspected.
- Reported GPU: `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)`.
- Standard smoke viewport: 1440×900, render scale 1, pixel ratio 1. Long-run viewport: 1920×1080.

## Passed checks

`npm test`: six meaningful simulation tests pass:

- Acceleration, braking/reverse, high-speed wall containment, and glancing wall movement.
- Matching simulation displacement under 30, 60, and 144 Hz render scheduling.
- Capture warning delay, exposure accumulation/decay, loss, and terminal-state priority.
- Real projectile hits and three-hit Recognizer destruction.
- A full authored route using steering/throttle/fire: 74.85 simulated seconds, three Recognizers destroyed, maximum centerline error about 1.29 meters.
- Independent clean state on restart.

`npm run build`: production bundle builds successfully. Vite reports the main JavaScript chunk is larger than its default 500 kB warning threshold; gzip is approximately 158 kB. This is primarily the Three.js renderer and addons, not remotely loaded game data.

`npm run test:browser`: Chrome checks pass with no page/console errors:

- Start and actual keyboard-driven movement.
- Pause/resume and restart.
- Cannon destruction using Space; scenario placement establishes a target, but actual projectiles and collision determine the result.
- Capture/loss and crossing the exit/win, both through real simulation rules.
- Ten restarts with one audio context and clean projectiles/kill count.
- Resize to 960×640.

The initial browser run exposed a GLSL reserved-word error in the capture-zone shader; that was corrected and the complete smoke check rerun successfully. Full-route simulation also exposed late enemy overtaking; approach timing and velocity-leading cannon aim were adjusted, and the route test now defeats all three encounters.

## Long-run / additional-browser checks

A ten-minute 1080p Chrome test drove eight complete winning runs using actual keyboard input, each taking 74.65–74.68 seconds and destroying all three Recognizers. No page/console errors occurred. After the first complete route, uploaded GPU resource counts stayed at 140 geometries and 13 textures through subsequent runs. Frame intervals after warmup were about 16.7 ms median and 16.8 ms at the 95th percentile.

The original harness ended with an assertion failure because its comparison baseline was taken at 30 seconds, before all canyon sections had appeared and uploaded their geometry. This was a test-baseline error: the log showed 131 geometries at 30 seconds, then 140 at 60 seconds and the same 140 for the rest of the run. The harness now compares after a complete route and saves its raw report before assertions. The targeted three-minute rerun passed with the corrected gate and the final pause-audio fix: two more winning runs, three kills each, stable 140 geometries / 13 textures, and no page/console errors. The raw report is saved in `test-results/soak.json`.

`npm run test:browser -- --lifecycle` passed: blur pauses and clears throttle, mute works, reduced-motion and low-quality modes render, graphics-context loss and unsupported WebGL 2 produce useful messages, and the production preview drives without development hooks. Local references in the built HTML and generated documentation also resolve.

Firefox/WebKit are not validated. The initial attempt using older cached builds stalled and was stopped. A bounded check using the current Playwright package's own paths reported that its matching Firefox 1543 and WebKit 2359 executables are not installed. The compatibility script now has a watchdog and accepts explicit browser-path overrides. Safari itself was not automated.

## Visual and sound review

Inspected screenshots show a clear chase view, solid faceted canyon walls, muted blue/purple surfaces, a rounded-pod tank, and a large solid Recognizer with warm edge details. The initial overly glossy tank highlights were reduced and antialiasing added to the postprocessing target. The vehicles remain procedural stand-ins; fuller film matching is still needed.

Audio graphs initialize from the Start gesture, synthesize all sounds locally, and maintain a single context over restarts. Positional sources follow the Recognizer and the listener follows the camera. Subjective loudness, engine weight, and the resemblance of the rotor/drone require human listening feedback; automated interaction does not establish sound quality.

## Remaining work and limits

- Human playtesting: tank feel, corner readability, camera motion, cannon aiming, capture fairness, and sound balance.
- Actual Safari testing. A Playwright WebKit result, if available, is reported separately and does not count as Safari validation.
- Final film-accurate assets. The 13 supplied frames now cover multiple angles; exact video timestamps remain unrecorded.
- No imported GLB asset has been exercised; the adapter exists for a later replacement.
- No mobile controls, backend, multiplayer, progression, or deployment.
- Performance claims apply to the recorded Mac/browser/quality setting; they do not establish low-end hardware performance.

Reproducible screenshots and raw reports are in the ignored `test-results/` directory. See the README for commands.


## September 12 — supplied-frame art and terminal pass

All 13 user-supplied PNGs were inspected. Rebuilt the tank deck, shoulders, canopy and cannon; rebuilt the Recognizer roof, body depth, end pods and leg panels; replaced jagged cliffs with flat-topped maze slabs, subtle wall panels and grid courts. Simplified Recognizer hit volumes were adjusted to the lower crown and deeper body. The route and vehicle dynamics are unchanged.

The home screen now uses local VT323 lettering, the two lines from the terminal still, timed character reveal with a line pause, a blinking cursor while typing, and a faint perspective grid. Enter skips typing and subsequently starts the game; reduced-motion preferences show all text immediately. Start instructions become visible after the sequence.

Verified on Chrome 152.0.7977.84:

- `npm test`: all six simulation tests pass after the hit-volume adjustment; complete route remains 74.85 simulated seconds with three kills.
- `npm run test:browser`: driving, pause/resume, shooting, loss, win, ten restarts and resize pass with no page/console errors. The smoke run recorded 153 uploaded geometries, 13 textures, 95 draw calls at its final sample and approximately 16.7 ms median/95th-percentile frame intervals at 1440×900.
- `npm run test:browser -- --terminal`: progressive partial text, hidden start controls during typing, Enter completion without accidental starting, a second Enter starting, reduced-motion immediate reveal and 640-pixel-wide layout pass.
- `npm run build`: production assets and all four colvmn documentation pages build successfully. Main JavaScript is approximately 161 kB gzipped; Vite's default chunk-size advisory remains.

The rendered terminal, chase and Recognizer screenshots were visually inspected. These establish a second reviewable interpretation, not final film fidelity. Sound is unchanged in this pass.

A fresh `npm run test:browser -- --soak --duration=180` passed at 1920×1080 with the final geometry and revised hit volumes: two completed wins (74.68 and 74.65 seconds), three kills each, no page/console errors, stable 152 uploaded geometries / 13 textures after warmup, and approximately 16.7 ms median and 95th-percentile frame intervals. Chrome required an approved launch outside the filesystem sandbox. The current raw report is `test-results/soak.json`; earlier figures above describe the first build.

## September 12 — manual turret and angular maze correction

Q/E now turns the turret independently of driving, including while stationary. Its angle is an offset relative to the hull and resets on restart. The rendered barrel remains level. Shot azimuth follows the manual turret bearing exactly; height assistance and vertical lead apply only to a horizontally aligned Recognizer. Unlocked shots stay level. Projectile origin follows the offset turret and muzzle.

The route now interpolates linearly between nodes. Wall buffers split at every route corner and use flat vertical faces, so neither the road nor the walls round the bends. Widths still taper linearly, and the layout remains an authored adaptation rather than the film's exact map.

`npm test`: all nine tests pass, including stationary turret rotation/reset, manual shot azimuth with vertical-only assistance, and straight spans/hard corners. Full-route simulation completes in 74.00 seconds with three kills and maximum centerline error 3.09 meters. A new assertion initially distinguished JavaScript negative zero from zero; it was corrected to compare heading magnitude.

`npm run test:browser`: Chrome 152 passes Q/E keyboard rotation without hull movement, level barrel with an elevated target, turret restart, movement, pause/resume, cannon destruction, loss, win, ten restarts and resize, with no page/console errors. Final smoke sample: 164 uploaded geometries, 13 textures, 101 draw calls; 1440×900 frame intervals approximately 16.7 ms median / 16.8 ms 95th percentile. Turret and encounter screenshots were visually inspected. The earlier 1080p soak predates this route/control correction and was not repeated for this update.

The asset inventory now includes four inspected internet model previews and metadata. No external model has been imported; Sketchfab's official source-download endpoint requires authentication.


## Default blueprint game entry

The normal game URL now selects the blueprint maze. `?maze=authored` retains the original; the reference studio keeps its original fixed-camera studies unless explicitly switched. `npm test` passed all 16 tests and `npm run build` succeeded. The Chrome reference check (`node tests/reference.mjs`) verified the plain `/` URL selects the blueprint, driving into its entrance and wall collision, five active Recognizers, and the explicit original-layout URL. Reference captures and documentation cards also passed with no browser errors.

## Recognizer crush attack — September 13

Read all four supplied attack frames. Added articulated leg closure and a sight-triggered, committed vertical strike, followed by recovery. `npm test` passed 19 tests, including autonomous approach/crush, escape after commitment, blocked descent, stale sight rejection, recovery and reset. `node tests/models.mjs` verified the unchanged 15 m model height and material independence and captured open, turning and closed poses. Inspected the rendered closed pose and in-game impact. `node tests/reference.mjs --attack` passed in installed headless Chrome with no browser errors: crush, escape, disabled wreck and R reset. `npm run build` succeeded; its existing bundle-size advisory remains.

Timing is inferred from four untimed stills. The imported wedge-shaped feet are simpler than the film's block soles. Descent clearance and weapon volumes remain conservative approximations rather than triangle-level rigid-body collision.

## Forward-thrust Recognizer flight — September 13

Replaced direct velocity targeting and lateral avoidance forces with bounded forward thrust, isotropic drag/braking, and heading-based avoidance. Momentum survives yaw changes; pitch and roll are zero. Crush preparation requires a slow approach and preserves decaying residual drift. `npm test` passed all 22 checks, including forward acceleration, turn momentum, avoidance direction, and crush approach/drift. Flight constants (meters, seconds, radians) live in src/simulation/flight.js. Physical overlap correction remains a collision constraint, independent of propulsion.

`node tests/reference.mjs --attack` also passed in Chrome: crush, escape, wreck controls and reset, with no browser errors. Production build succeeded.

## Attack approach damping

Increased passive drag from 0.45 to 0.7 per second and added braking drag from 1.15 to 2.4. Increased available forward acceleration to preserve cruising capability. When inside a visible target’s clear strike footprint, the aircraft holds its heading and brakes instead of turning after its overshoot. All 23 simulation tests passed, including a regression for settling into an attack without yaw changes. This tuning pass was checked through simulation tests; visual feel remains for user review.

## Close-range steering and aerial view corrections

Reproduced five aircraft spinning around a stationary target: 1.70–1.94 accumulated turns per craft over 20 simulated seconds. Close-range yielding and alignment reduced this to 0.45–0.77 turns in the same scenario, with a successful crush. Hover stabilization now works even where a roof blocks descent. All 25 simulation tests passed, including the crowded approach and blocked descent regressions. Chrome attack checks passed for the five-craft approach, crush, escape, reset and Space Paranoids page title with no browser errors.

V aerial view previously used the ground-camera grid cutoff (650 m), below much of its viewing distance, and reduced floor brightness to 16%. It now has its own floor visibility, grid fade at 1800–3000 m, and fog multiplier 0.06 (previously 0.35). The floor geometry remains at ground level. Ground cameras and reference-studio lighting retain their existing settings.

Aerial grid follow-up: reduced V-view line blend from 0.95 to 0.22 to soften the overly bright white lattice. Floor visibility and aerial fog remain as corrected; ground-view grid styling is unchanged. Production build passed.

Further aerial-grid adjustment from user review: reduced line blend from 0.22 to 0.045 for a faint lattice. Floor brightness is unchanged.

## Terminal-to-grid opening

Added a 5.5-second opening: terminal fade, grid reveal, camera descent to Clu. Simulation time remains frozen during it, and audio unlock still comes from the start gesture. Escape pauses/resumes the sequence; Enter or Space skips it. Reduced-motion mode begins gameplay immediately. R resets directly into gameplay.

`npm run test:browser -- --terminal` passed typing, Enter start, frozen simulation during camera movement, pause/resume, reduced-motion bypass and narrow viewport checks. Inspected fade and grid-reveal captures. Production build passed.

## Nearby Recognizer camera framing

Added a smooth upward tilt for nearby visible aircraft in the forward camera sector. A pullback of up to 32 m and up to 8 additional degrees of vertical FOV allow an overhead craft and the tank to share the frame. Pitch is capped against the tank top after camera collision adjustment. Aerial, opening and studio cameras retain their own framing. `node tests/reference.mjs --camera` passed projected tank-top and Recognizer-crown visibility at heights 77, 30 and 11 m with no browser errors; inspected captures. Build passed. The first test attempt was interrupted by a development reload during the concurrent build; the sequential rerun passed. Walls can limit the available pullback, so full-aircraft framing is not guaranteed in confined passages.


## Film-derived stereo audio

Four stereo samples extracted from the local video and decoded successfully in Chrome. Original-channel correlations are 0.33 (tank), 0.75 (Recognizer flight), 0.46 (approach), 0.96 (cannon), confirming preserved channel differences. Peak amplitude is 0.72; none clip. The stereo HRTF test measured left-source RMS L/R 0.380/0.280 and right-source RMS 0.279/0.379; moving the emitter farther reduced right RMS to 0.040, while wall filtering/attenuation reduced it to 0.155. Approaching/receding Doppler ratios were 1.045/0.958.

`node tests/reference.mjs --audio` passed left/right direction, distance, wall muffling, Doppler, four sample decodes, audition start/stop, pause, stable loop count (11 sources) across firing/resets, one AudioContext, and an individual missing-sample fallback. An initial test omitted the wall gain multiplier; corrected the fixture to exercise both filtering and attenuation. A development reload interrupted the next attempt; the stable rerun passed. These are signal and lifecycle checks, not a listening judgment. Auditory review of background soundtrack and loop quality remains pending on the audition page.

The final production build and `npm run test:browser -- --lifecycle` passed: mute, blur/pause, quality/reduced-motion settings, error paths and production driving.

Tank dialogue correction: replaced the reported spoken section with a short opening texture, retaining stereo and a smooth loop crossfade. Verified 0.58 s duration, two channels and peak 0.72. Hash checks confirm both Recognizer loops and cannon are untouched. Versioned the tank URL to avoid stale browser audio.

## Tank-loop tone and post-crush patrol

Reduced the tank loop’s end-of-loop 330 Hz component by 15.7 dB after normalization, using a −18 dB/Q=4 notch and a 650 Hz low-pass. Other sample SHA-256 hashes remain unchanged. Tank sample URL is revision 3. Listening review remains with the user.

Confirmed destruction now invalidates target memory, aborts redundant strikes into recovery and propagates through existing delayed/range-limited radio. Old sightings cannot restore pursuit. All 26 simulation tests passed, including return to wander after recovery, stale-message rejection and reset. The close-approach turning regression now stops measurement at the crush; subsequent legitimate patrol turns are no longer counted as attack circling.

Opening text polish: a CSS block cursor follows the typed text, stays visible during typing, then blinks after completion and fades with the opening transition. Removed maze-selection links from the terminal screen.

Home-page simplification: hide all terminal actions, controls, explanatory copy and links; only access text and cursor remain. Return completes typing or starts the opening once typing is complete. Browser scenarios now enter using Return.


## September 13 — opening, controls, distance and sound revision

- `npm test`: 29 passed, including immediate reverse after a blocked wall approach, tangential sliding, and 1,000-foot three-dimensional radio range.
- `npm run build`: passed; existing large-bundle advisory remains.
- Chrome via `npm run test:browser -- --terminal`: passed typing/start, no pre-start grid, live Recognizer motion, full-speed tank startup, camera position relative to the moving tank during descent, W release, paused simulation, reduced motion and narrow layout.
- Chrome lifecycle checks: passed minimal standby, held-W resume, consumed fire/reset/view keys, focus loss, failure states and production driving.
- Chrome camera checks: passed turret orbit at ±90°/180° and keeping tank/overhead Recognizer in frame.
- Chrome audio checks: passed stereo direction, distance attenuation, wall filtering, Doppler, sample decode, restart resource stability and missing-file fallback.
- Inspected `test-results/opening-clu.png`: distant maze silhouette visible from the exterior approach.
- Audio listener now follows camera position (superseding the earlier tank-anchored listener). Tank uses a stereo emitter with an 18 m reference distance. Terminal audio initializes before typing when browser autoplay policy permits; a user gesture is required when policy blocks playback. Cannon/terminal timbre still needs human listening approval.

Opening-pursuit follow-up: terminal browser check passed with exactly three initial pursuers; all three project inside the opening camera frame. Inspected `test-results/opening-fade.png` and confirmed the staggered formation is visible behind moving Clu. Unit tests remain 29/29 and production build passes.


Music/terminal follow-up: production build and Chrome audio regression passed, including music playback, pause/resume and restarting from the beginning. Typing-audio browser check passed: clicking the ready screen resumes audio and replays all 59 non-newline character tones, then Return starts normally. Click gain increased from 0.035 to 0.16 of master volume and duration from 18 to 35 ms. Browser autoplay permission still determines whether the first unprompted typing is audible.


## Formation, lead and destruction checks

- `npm test`: 33 passed. New checks cover a twenty-second advancing formation with preserved lateral spacing, speed coordination, 3D intercept solutions, and an actual simulated projectile hitting a crossing Recognizer.
- `npm run test:browser -- --terminal`: all three more distant pursuers remain inside the opening frame.
- `npm run test:browser -- --breakup`: passed model-fragment variation across two destructions, paused debris, falling pieces and GPU geometry cleanup after expiry. Inspected early and falling screenshots. Timing assertions follow effect age rather than wall-clock capture duration.
- Production build passed, with the existing bundle-size advisory. Fragments use surface partitions, not closed volumetric fracture meshes; wall/floor response is approximate and fragments are visual, not damaging simulation actors.


Latest checks: 34 unit tests passed, including dynamic lead/support reassignment and dissolution, shortest-path turret centering and manual interruption. Chrome opening-controls checks passed keyboard/mouse fire, driving and turret operation during zoom, and held-input continuity. Typing-audio check decoded four film-derived samples and replayed all character clicks. Lifecycle check passed F centering, pause/resume and production controls. Audio check measured nonzero output during the opening with zero shots fired. Keyboard tail revision verified all four PCM clips end at zero with final-10-ms RMS below 15% of their first-30-ms RMS. Human listening review remains necessary for timbre.


Smaller terminal/CRT revision: build and terminal browser checks passed. Inspected the 1440×900 capture: smaller text remains readable under the scanlines. Opening fade, reduced-motion entry and narrow viewport checks also passed.


Turbo and predictive-stomp revision: 37 unit tests pass, including full ten-second boost, one-minute recharge, braking, reset/crush state, predicted fold/drop timing, misses after changing course, and autonomous moving-target interceptions from three initial separations. Chrome terminal checks confirm all five initial pursuers remain in frame; inspected the rear-view capture after restoring roof-clear flight altitude. Chrome turbo/hints checks passed T activation, pause/expiry, recharge lockout and ready indicator, plus centered single-row hints after input inactivity. Production build passes.


Aerial zoom: build and Chrome aerial-zoom checks passed. Wheel scrolling reaches the 150–2,400 m height limits smoothly, works paused, preserves zoom across V toggles and ignores scrolling in driving view. Inspected the far overview capture; maze and floor render without clipping.

## September 13 — carrier and localized breakup

- `node scripts/prepare-carrier.mjs`: converted the DAE, confirmed all seven textures loaded, round-tripped GLB in Chrome and captured `test-results/carrier-preview.png`. Inspected the rendered silhouette and materials.
- `npm run test:browser -- --carrier`: passed in headless installed Chrome, outside the sandbox. Measured constant +X transit at 24 m/s, constant altitude/depth and frozen position during standby. Six direct surface hits (body and each leg, open and folded) selected the expected part, preserved two intact sections, and conserved every source triangle. No page errors. Inspected `test-results/carrier-game.png`.
- `npm run test:browser -- --breakup`: passed randomized breakup, falling, pause and geometry cleanup. Updated the fixture to cruising altitude: the earlier low-altitude fixture inherited climb velocity and invalidated its four-second falling expectation.
- `npm test`: all 37 simulation/blueprint checks passed.
- `npm run build`: passed; existing large JavaScript chunk advisory remains. Carrier adds 6.86 MB to packaged assets. No interactive human performance/fidelity sign-off is implied.

## BEGIN button and carrier visibility

`npm run test:browser -- --typing-audio` passed with Chrome user-activation autoplay policy: no terminal or grid before BEGIN, four decoded typing samples and 59 character clicks after activation, no restart from an incidental click, and Return starts the opening. `--terminal` passed typing, skip/start, opening, pause/resume, reduced motion and narrow viewport. `--carrier` passed transit/pause and section integrity checks. Inspected `test-results/begin-button.png` and `test-results/carrier-game.png`; the complete carrier hull is visible against the dark sky. Build passed with the existing chunk-size advisory.

Carrier contrast correction: restored source hull colors and textures, reduced blue emission, and adjusted roughness for directional shading. Applied a small depth offset to the original illuminated trim so coplanar hull surfaces do not hide it. Inspected the revised in-game capture; `npm run test:browser -- --carrier` passed.

Carrier red/blue trim pass: `npm run test:browser -- --carrier` passed. Inspected `test-results/carrier-game.png`: subdued red outline with visible smaller blue panel boundaries. Production build passed.

## Roaming map patrols

`npm test`: 38 checks passed, including separated/reproducible unalerted patrols, vision cutoff with altitude, wall occlusion and information-limited search. `npm run test:browser -- --patrols`: nine aircraft and sound voices initialized; four extra patrols moved autonomously and froze during pause, without page errors. Production build passed.

Carrier presence / section refinement: `npm run test:browser -- --carrier` passed audio sample decode (no load errors), animated beacon changes, straight transit/pause and triangle conservation with five unhit sections retained whole. `--breakup` passed randomized motion, falling, pause and geometry cleanup. Inspected final-shot contact sheets and updated in-game screenshot showing the more distant/left carrier and brighter maze seams. Build passed. Audio timbre and precise film blink phase are not claimed verified.

Clu breakup: all 38 simulation tests passed. `npm run test:browser -- --tank-breakup` passed actual autonomous stomp, fragment creation, intact tank/shadow hiding, paused debris, expiry and restart restoration. Inspected `test-results/clu-breakup.png`, including the new blue fracture boundaries. Build passed. The browser fixture was corrected to wait for BEGIN audio initialization before pressing Return.

Static terminal: `npm run test:browser -- --typing-audio` passed immediate full text, absence of BEGIN, zero typing clicks and a single Return starting the opening with audio unlocked. Build passed.


### Recognizer searchlights — September 13

`npm run test:browser -- --searchlights` passed in headless Google Chrome on macOS. A controlled search encounter produced a visible beam, inspected in `test-results/recognizer-searchlight.png`. Tests check active/inactive aircraft, frozen pause intensity, disabled attack/pursuit poses, and geometric wall/floor ray clipping; no browser or shader errors were reported. This does not establish film-exact motion. The camera-facing ribbon approximates a volume; surface illumination and matching a future video remain open visual refinements.


### Ground escorts and shared radio — September 14

The existing 38 simulation tests and eight ground-tank tests pass. New coverage includes carrier pace, sight range/facing/occlusion, bidirectional ground/air radio with unchanged sighting age and range, independently aimed rounds destroying Clu, Clu destroying enemies, independence from hidden Clu movement, swept route clearance around a slab, and ground formation leader replacement.

`npm run test:browser -- --ground-tanks` passed in headless Google Chrome on macOS. Checks cover eight units, turret movement with a level barrel, enemy fire, Clu and enemy tank fragmentation, pause and reset, with no browser/renderer errors. Rendered captures inspected: `test-results/ground-escort.png`, `test-results/enemy-tank-firing.png`, and `test-results/enemy-tank-breakup.png`. Build passed. Large-scale traffic through every blueprint passage and enemy sound balance remain human playtest items.


### Startup presentation — September 14

The HTML supplies a black background immediately and loads the stylesheet through a render-blocking link. Content is hidden until styles apply, avoiding an unformatted text flash. Controls appear at game entry and remain until ten simulated seconds after the first gameplay key press; the Return used to start does not count. Later keyboard activity re-enables the idle reminder. Pausing freezes the countdown, and resetting starts it over. `npm run test:browser -- --startup-ui` passed with deliberately delayed CSS, initial controls visibility, timed fade and subsequent idle reminder checks.


### September 14 follow-up checks

Simulation coverage now includes stabilized gunner yaw, manual shot elevation, pitch limits, zoom-sensitive aiming, alert decay/renewal and cross-unit reports, and reverse turbo direction/caps/easing. Browser checks `--gunner`, `--cruise`, and `--searchlights` passed in Chrome. `test-results/gunner-sight.png` was visually compared with the supplied reticle image. Controls/startup checks also cover delayed CSS and initial hint timing.

The final simulation suite passes all 52 tests. Gunner controls use J/L in both views, I/K for elevation, and O for zoom; Q/E rotation is disabled. Zoom sensitivity is tested against the field-of-view ratio.

Gunner inertia follow-up: all 53 simulation tests pass, including acceleration, release/deceleration, direction reversal and clearing motion on mode exit. The gunner Chrome check passed with settled aiming before stabilization/projection assertions.

`npm run test:browser -- --death-terminal` passed: a real fatal projectile triggers breakup, partial opacity during the fade, the exact two-line message with hidden game/HUD/cursor, and Return into a fresh run. The terminal capture is `test-results/death-terminal.png`.

Final sizing/weapon checks: all 55 simulation tests passed, plus the strengthened scale-dependent separation check. `node tests/models.mjs` verified Recognizer height 19.5 m, feet at ground height zero, correct muzzle transforms, and folded poses without errors. The imported-model capture was inspected. F leveling and the five-second Clu projectile lifetime are covered by focused tests; the gunner Chrome check passed after those updates.

Recognizer breakup pacing: `npm run test:browser -- --breakup` passed in headless Chrome on macOS. Verified one fragmented section and five intact detached sections, randomized outcomes, falling debris, pause freezing, and geometry cleanup. Inspected the early and four-second falling captures; debris has reached the floor by the latter capture.

Stronger blast follow-up: the Chrome `--breakup` check passed again; inspected the falling-debris capture for broader scattering. Anatomical fragmentation, pause and resource cleanup checks remain passing.

Fourth gunner zoom: all six focused gunner simulation tests and Chrome `--gunner` passed, covering reduced yaw/pitch sensitivity at all four levels and O cycling through the 8× label back to 1×.

Film effects/audio: `node tests/recognizer-audio.mjs` passed in headless Chrome on macOS: stereo WAV decoding, 1.88-second loop / one-second explosion, audible rendered output, left/right positional energy and one-shot source cleanup. The first attempt was interrupted by a development-server reload; the rerun passed. Direct listening remains for user review. `npm run test:browser -- --breakup` passed after adding optical effects and staged section release, including single-section fragmentation, pause and geometry cleanup. Inspected `recognizer-breakup-early.png` against extracted film frames: double yellow rings and sparks render around the separating sections in gunner view.

Muzzle/audio correction: `node tests/muzzle-flash.mjs` passed in Chrome: chase/gunner rendering, paused timing, actual firing and expiry, without console errors. Inspected both muzzle captures against the supplied still and extracted 1:51 frames. `node tests/recognizer-audio.mjs` passed for the final M4A-derived samples: 0.85-second stereo explosion, audible offline rendering, positional balance and cleanup. Direct auditory confirmation remains with the user. PCM comparison verified the M4A/video alignment exactly after 2112 audio frames.

Gunner flash correction: `node tests/muzzle-flash.mjs` passed in Chrome with hidden gunner flash, visible external flash, pause freezing and expiry. Cleanup candidates were generated with finite, unclipped stereo PCM and matching durations; waveform alignment was verified against the full scene. Audio quality/source isolation needs user listening review.

Sound library: `node tests/sound-library.mjs` passed in headless Chrome on macOS. Checks cover unique catalog IDs, existence of local media/catalogs, downloaded-preview SHA-256 hashes, documentation card navigation, 17 rendered players, all four downloaded previews loading valid durations, and successful playback. Inspected the library screenshot. Listening/film-match judgments remain for audition; commercial catalogs contain metadata only.

Recognizer armor audio: all 56 simulation tests pass, including target/fatality event tagging. The extended `node tests/recognizer-audio.mjs` check passed for audible spatial impact output, source cleanup and suppression on fatal hits. The audio harness disables Vite HMR to prevent dependency-optimization reloads interrupting offline rendering. Subjective sound review remains available through the audition page.

## Production subdirectory deployment — September 14

`npm run build` and `node tests/production-path.mjs` passed against a static production build mounted at `/fun/TRON/`: game starts, all three vehicle models and game audio load, and the sound study plays without HTTP or JavaScript errors. Vite uses a relative base and runtime audio resolves below the game path. The website workflow builds the pinned private submodule with a read-only deploy key and publishes its dist output.

## Tank speed and impact feedback — September 14

All 57 simulation tests passed, including enemy pursuit reaching normal Clu speed without inheriting turbo and escorts keeping pace with the carrier. `node tests/impact-shake.mjs` passed in Chrome: impact changes the rendered view, freezes on pause, leaves turret aim unchanged, and respects reduced motion. Collision feedback preserves a previous stronger hit, ignores low-speed wall pressure, and decays over approximately 0.4 seconds. Production build passed.

## Forward-and-level turret return — September 14

All 59 simulation tests and the gunner browser suite passed. F centers yaw and levels elevation, using the same movement rates and gunner acceleration as manual controls at all four zoom levels. Tests cover exact final alignment, short-path centering, turning hulls and manual override. Production build passed.

## Cannon shot reserve — September 14

All 63 simulation tests and `node tests/cannon-reserve.mjs` passed. Coverage includes one-per-second recharge capped at three, four rapid shots from a full bank, normal cooldown after exhaustion, held-fire behavior, refill after resting, pause, reset and destruction. Real Space presses consumed reserves in Chrome; pausing prevented recharge. Production build passed.

### Cannon reserve timing update

Reserve recharge now requires ten uninterrupted seconds without firing and restores all three extras at once. Simulation tests cover the exact boundary, no partial refill, partially spent reserves, timer restart on firing, and destruction. All 63 simulation tests passed; production build passed.

## Patrol mix and spotlight confirmation — September 15

All 67 simulation tests passed: roster, ground patrol movement/clearance, delayed spotlight confirmation and radio, bounded angular motion, beam range and wall occlusion, failed acquisition, hidden-target behavior, tracking and fade. `node tests/spotlight-acquisition.mjs` passed in Chrome on the default blueprint: three aircraft/audio voices and eleven ground tank models, three moving maze patrols, acquisition before pursuit, visible tracking, paused beam state, fade and continued pursuit. Reviewed `test-results/spotlight-lock.png` showing the beam on Clu. Corrected a blueprint spawn that passed hull clearance but failed swept route clearance. Production build passed.

### Spotlight reach and scanning fix — September 15

All 69 simulation tests passed. Added a 500 m target case verifying elevation above the scanning pitch, actual rendered beam reach and successful confirmation, plus bounded scanning after abrupt goal changes. Chrome acquisition/tracking/fade check passed at 500 m and the rendered capture was reviewed with the beam on Clu. Scanning still uses 260 m; target acquisition uses the sensor range so an observer cannot freeze forever trying to illuminate a visible tank beyond the old beam limit. Production build passed.

## Aerial transition and close patrol encounter — September 16

All 71 simulation tests passed. Chrome checks `tests/aerial-transition.mjs`, `tests/aerial-zoom.mjs`, and `tests/maze-tank-awareness.mjs` passed against an isolated local Vite server: smooth V transitions both directions, turret-aligned aerial view, wheel zoom including pause, and an actual blueprint patrol detecting Clu behind it and landing a shot. Unit tests cover close rear detection and reaction to a nonfatal shot from beyond near-awareness range. Production build passed.

## Patrol routing and radio response — September 16

Reproduced a blueprint patrol stopping permanently near (138, -252) after its steering entered the pathfinding clearance margin. All 73 tests now pass, including a two-minute blueprint patrol run checking movement every 20 seconds and clearance every step. A radio-only test verifies a Recognizer can send an occluded target report to a nearby ground patrol, trigger a route around the wall and move the tank without granting direct sight or fire permission. The close-range blueprint encounter also passed in Chrome after the navigation change. Production build passed.

## Turret stabilization motor limit — September 16

All 77 simulation tests passed. Coverage includes all Clu views and zoom, manual aim plus hull compensation within a single relative-to-hull motor speed budget, recovery after saturation, idle enemy turret world-heading hold, and abrupt externally imposed yaw changes including angle wrap and zero dt. The gunner Chrome suite passed for aiming, stabilization, zoom, F centering, firing, pause and exit. World-space motion caused by the hull itself is distinct from the turret motor: if the hull outruns compensation, aim drifts instead of exceeding motor speed. Production build passed.

### Mouse gunner verification — September 16

`npm test`: 81 passing. Includes target convergence and rate limits at all zoom levels, forward lock/manual release, minimum elevation, nearest visible surface raycast, occlusion, hidden-object exclusion and empty-sky fallback. Chrome headless on isolated port 5174: revised `tests/mouse-aim.mjs` verifies pointer capture, independent view/gun lag and convergence, firing, forward lock, mouse unlock and pause/view lifecycle. `tests/gunner.mjs` covers keyboard controls. Mouse feel remains for human playtesting.

### Visibility, turbo and spotlight checks — September 16

82 simulation tests pass, including sustained distant spotlight tracking, close-range fading and lost-observation behavior. Chrome checks on isolated Vite port 5174 passed: mouse aiming with the complete sight, `tank-visibility.mjs` material isolation plus live turbo pulse/return to normal, and `spotlight-acquisition.mjs` sustained tracking, pause and close-range fade. Reviewed low-angle enemy and turbo-trim renders under representative lighting; in-game brightness remains subject to user review.

### Smooth mouse tracking — September 16

83 simulation tests pass. Added measured angular velocity/acceleration checks at all four zoom levels with sudden target changes and reversals on a stationary hull, including arrival at the target. Chrome `tests/mouse-aim.mjs` passed with interpolated full-sight rendering, target convergence, firing, F lock and pointer lifecycle. Human smoothness assessment remains necessary; numerical limits alone do not establish feel.
