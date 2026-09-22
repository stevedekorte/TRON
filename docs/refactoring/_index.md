---
title: Refactoring review and design
subtitle: Explicit ownership, reproducible worlds and composed controllers
---

## Recommendation

Refactor incrementally. The game has useful module boundaries already, but several objects now own too many decisions and lifetimes. The best use of OOP here is to give stateful responsibilities clear owners and small public APIs, while retaining plain simulation records and pure geometry functions.

The findings below record the pre-refactor review on September 22, 2026. The implementation section describes the completed ownership extraction; it is not a claim that all runtime defects have been found. The authoritative implementation checklist is in the [project plan](../index.html). Existing behavior is the migration baseline; intentional gameplay changes should be separate commits.

## Findings grounded in the code

| Priority | Evidence | Consequence | Recommended boundary |
|---|---|---|---|
| First | `src/levels/maze.js` selects its layout from `location`, changes defaults between Node and browsers, and generates a separate browser layout seed at module load. `createRun(seed)` does not control that world seed. | The authored-layout tests passed while the actual blueprint opening could not find a route. A run seed alone cannot reproduce a browser encounter. | Explicit world/scenario construction shared by browser and tests. |
| First | `Autoplay.plan()` and `input()` combine perception, threat classification, objective selection, route caching, JEV options, waypoint advancement, braking, turret aim and turbo. `apply()` also owns waypoint progress. | Mission decisions, provider replies and motor execution can reset or override each other. The waypoint reset and corner-arrival stalls are concrete examples. | Separate mission planning from a persistent route follower and from request snapshots. |
| High | `src/main.js` owns startup, UI modes, manual controls, hidden-tab scheduling, fixed stepping, network updates, effects, audio, tuning and a large mutable debug surface. | Pause, restart, input takeover and error handling require coordinated edits across unrelated handlers. | An application coordinator composed from session, loop, input and HUD owners. |
| High | `createRun()` stores Clu's pose and controls on the same record as enemies, world events, projectiles, beams and session state. Many systems mutate that record. | Ownership is implicit; a presentation/controller change can accidentally affect unrelated simulation state. | A simulation session owns the record and ordered updates; gradually group state behind compatibility adapters. |
| High | `JevClient.update()` selects units, schedules calls, handles aborts/retries, applies decisions, tracks cost and directly disables autoplay. `reset()` clears some state while preserving quotas and round statistics through other fields. | Transport, game policy and lifetime rules are difficult to change independently. | Transport, decision coordination and request policy with explicit session/revision identifiers. |
| Medium | `View.render()` includes multiple camera modes, interpolation, vehicle synchronization, aiming, lighting, effects and render passes. `main.js` invokes `view.breakups.physics` to feed damage back into simulation. | Simulation ownership crosses into rendering; camera changes have broad regression risk. | Extract camera coordination first; move physical debris ownership to simulation through an adapter. |
| Medium | `Sound` owns sample loading, synthesis, spatial voices, listener updates, music selection and Web Audio lifecycle. `View.dispose()` combines subsystem disposal and scene traversal. | Resource ownership is harder to audit. Existing cleanup is substantial; this review does **not** establish a leak. | Explicit audio/visual owners with documented borrowed versus owned resources. |
| Medium | Browser stats import the request builder from `server/jev-protocol.js`; server budgeting imports pricing from `src/ai/jev-stats.js`. Local and Worker error mapping differ and timeout classification partly reads message text. | Dependency direction is confusing, and accounting/error policy can drift between deployments. | A small environment-neutral protocol/pricing module; keep deployment-specific quota policies separate. |
| Maintenance | Dense multi-statement lines, mutable global configuration and historical statements in `Goal.md` make current behavior harder to establish. For example, old beam/blast/teleport descriptions are superseded later. | Reviews and tests must infer both ownership and which description is current. | Format touched modules, add boundary contracts and distinguish current decisions from history. |

Do not start by converting every function to a class. `mergeAutoplayInput`, geometry intersections, projection math, trajectory calculations and snapshot construction remain good candidates for pure functions. Existing small objects such as `BeamCamera`, `JevStats`, `JevSpend` and `SystemWarnings` demonstrate useful bounded ownership.

## Design principles

- Prefer composition. No `GameObject → Vehicle → Tank → PlayerTank` hierarchy, custom ECS, service locator or general event framework.
- Use classes when there is meaningful private state, identity or a lifecycle. Use records for observations, poses, commands, routes and wire messages.
- Pass dependencies explicitly through constructors or factory parameters. Do not pass the whole application into every object.
- Keep simulation at 60 Hz. Distinguish simulation seconds, monotonic elapsed time for pacing, and persisted wall-clock timestamps for hourly budgets.
- Maintain the information boundary: enemy planning receives observations, aged radio/hearing reports and permitted map queries, never unseen live Clu coordinates.
- Keep rendering, audio, networking and DOM work outside the deterministic simulation step. Preserve the current ordered effects/damage semantics during extraction.
- Start with JSDoc contracts and targeted `// @ts-check` where useful. A TypeScript migration is not a prerequisite.
- Keep named units and configuration. Give a session a configuration snapshot; development tuning changes it through explicit commands rather than mutating unrelated module globals.

## Proposed ownership

These are responsibilities to extract as needed, not a requirement to create every named class immediately.

| Owner | Owns | Public responsibilities | Lifetime |
|---|---|---|---|
| `GameApp` | Composition, browser adapters, loading/error screens | Start, pause/resume, select autoplay, dispose | Page |
| `GameSession` | Run state, simulation RNG, event queue, controllers | Fixed-step advance, capture display state, restart from scenario | Round |
| `GameLoop` | One timer/animation-frame handle, accumulator | Schedule, suspend, bounded background catch-up, dispose | Page |
| `InputController` | Held keys, mouse state, queued actions | Produce manual command, clear transient input, dispose listeners | Page |
| `World` / `createWorld` | Layout geometry, derived sites, spatial queries | Clearance, visibility and map queries | Scenario |
| `AutoplayController` | Mission selection, current objective, threat transition state | Produce requests and commands, accept current decisions, enable/disable | Round |
| `RouteFollower` | Route identity, cursor, turn/arrival state | Advance a route using the observed pose; report progress/failure | Vehicle controller |
| `JevTransport` + decision coordinator | HTTP calls versus participant selection/application | Fetch a decision; coordinate fair requests and reject obsolete replies | Page, with round scopes |
| `CameraRig` | Follow/aerial/gunner/beam transitions | Resolve camera intent, update pose, reset | View |
| Visual/audio owners | GPU resources, voices, music | Consume display state/events, reset effects, dispose | Page with round reset |
| `HudPresenter` / debug adapter | DOM updates / development commands | Display immutable summaries; apply explicit fixture commands | Page |

A `World` can initially be the object already returned by `createMazeWorld`; it need not become a class just for naming symmetry. Extract pure candidate-building functions from `Autoplay` before inventing additional planner classes.

## Contracts that remove the current ambiguity

### Reproducible scenario

Introduce a plain `ScenarioSpec` containing `layout`, `layoutSeed`, `runSeed`, site count, spawn/encounter settings and relevant configuration. Browser URL/preferences choose it at the application boundary. Tests supply it directly without writing `globalThis.location`.

Derived pads, beams, carrier placement, patrol rosters and visual pool sizes must come from that same world. Merely injecting `World` into the route finder while leaving those as import-time constants would preserve the mismatch. Keep the existing module exports temporarily as adapters while migrating callers.

### Commands and state

Define `VehicleCommand` for throttle, steering, turret, elevation, fire/fire edge, mouse target and turbo. Both human input and autoplay produce this contract; the existing channel merge rule stays a pure function. Toggling views or autoplay is an application command, not a motor input.

Initially keep `createRun()`/`step()` callable to avoid changing every test. Wrap them in `GameSession` and extract responsibilities behind that seam. Later move Clu fields into a `player` record if it measurably improves ownership; do not combine that schema change with controller extraction.

Document the update order before moving it: current teleport/hearing checks, transfer locking, motors, enemy/carrier updates, weapons, beam completion, later teleport/hearing checks, debris impacts and event delivery. Apparently duplicate calls may be intentional same-tick boundaries.

Use explicit ordered event records for effects. Drain each batch once; listeners receive the batch rather than independently removing events. Do not create a global event bus. Decide and test same-tick versus next-tick debris damage before moving physics out of `View`.

### Mission, route and motor

Represent a route with an ID, world revision, objective ID and typed waypoints. Distinguish `passThrough`, `corner` and `stop` semantics; a beam stop is not a corner tolerance. Give `RouteFollower` sole ownership of its cursor and turn/creep state. Confirming the same JEV option must not restart it.

Return a result such as `following`, `arrived`, `blocked` or `needsReplan`, plus diagnostics: current waypoint, heading error, target speed, blocked segment and time without progress. Mission logic decides what to do with failure; motor code does not silently replace the objective or fall into endless hold/explore cycles.

Separate geometric route data sent to JEV from the mutable execution cursor. Keep plans versioned and snapshots detached from live state. Share clearance/search utilities between player and enemies, but do not unify their different sensing, attack and mission policies into one universal brain.

### Requests and lifetimes

Use a request ticket carrying `sessionId`, unit ID, plan revision, teleport revision and observation timestamp. A decision coordinator applies a reply only to the corresponding live participant. The transport returns a typed result, not direct mutations of autoplay or the run.

Separate operations currently folded into `reset()`: cancel pending request; pause scheduling; begin a new round; clear round history; dispose the client. Preserve provider cooldowns and the persistent spend ledger across round changes. Keep round stats across autoplay toggles and count attempts—including retries—according to the existing HUD definition.

Inject fetch, clock and timer scheduling for tests. Retry only typed timeout outcomes; preserve the two retries, explicit cancellation behavior, player/enemy fairness and user-selected autoplay state. Add a shared error code to local/Worker responses while retaining their different budget implementations. Never move credentials into shared/browser modules.

### Resources and presentation

Extract the camera state machine from `View` before reorganizing shaders. Give each effect an explicit owner for its unique geometry, materials, render targets and listeners. Shared model assets are borrowed and released by their asset owner. An optional small disposal helper is sufficient; avoid a general resource framework.

Keep shader composition order and program cache keys explicit. Materialization clipping, grid/pad shading, custom shadows and fog interact; a file move must not silently change their ordering. Preserve current visuals with captures before and after each extraction.

Split music policy from spatial voices only after the application/session boundaries are stable. Retain Safari audio unlock, pause/mute, source-ended cleanup and the existing sound character. No new audio engine is needed.

## Incremental delivery order

The checkbox status belongs only in the root project plan. Each item below should be a small series of reviewable changes, not one large rewrite.

### 0. Establish the baseline and contracts

Record both layouts, explicit seeds, runtime configuration and expected behavior. Add replay/diagnostic capture for route failure without credentials. Preserve the current third-maze route-failure report as an open defect; do not silently declare it solved by structural changes. Expand dense code only in the area being extracted, preferably in a separate mechanical commit.

Acceptance: reproduce the first-beam corner regression and two-beam success on the blueprint; authored comparisons still work. Save browser/device and relevant screenshots. Record failures honestly before implementation.

### 1. Make world construction explicit

Extract browser selection into bootstrap. Introduce the scenario factory and migrate world consumers gradually, including derived level data and view pool initialization. Keep a compatibility adapter until all imports can be moved safely.

Acceptance: two worlds with different seeds/layouts can coexist in one test process; equal scenario specifications produce equal placements; restart semantics match browser play; no core test needs browser globals just to choose the maze.

### 2. Extract route execution from autoplay

Introduce the route/waypoint contracts and `RouteFollower`; keep mission scoring and safety tuning unchanged initially. Add progress reporting and centralize route acceptance/invalidations. Preserve `Autoplay` as the public facade while moving its pieces. Only afterward use the clearer diagnostics to fix the separately documented third-maze failure.

Acceptance: same-choice replies preserve progress; short corners do not inherit final-stop tolerances; turbo reserves stopping space; destroyed threats trigger mission continuation; manual channel overrides and teleports remain correct. Test blueprint departure and second capture, plus the known later failure as a separately identified scenario.

### 3. Extract application/session lifecycle

Move scheduling into `GameLoop`, DOM/input into their adapters, and ordered fixed-step work into `GameSession`. Keep `main.js` as wiring. Use named application states and explicit transitions rather than a framework. Introduce the debris-physics seam without changing its time ordering.

Acceptance: one active loop after repeated starts; explicit pause freezes simulation; autoplay alone continues in the background; loss of JEV while unattended pauses; teleport interpolation does not smear; returning from the terminal resets exactly the intended state. Development inspection cannot mutate a session through an accidental shallow-copy getter.

### 4. Separate JEV coordination and transport

Move neutral request/response/cost contracts into a shared module. Extract transport and request policy without changing prompts, candidate choices, quotas or pricing. Give the coordinator small player/enemy participant adapters rather than importing entire navigation implementations.

Acceptance: fake-clock tests cover retries, cancellation, old-session replies, fairness, cooldown persistence and stats lifetimes. Local and Worker response-contract tests agree on error classification; their distinct quota tests still pass. Check browser builds for server-only imports and secrets. No paid requests are necessary for routine tests.

### 5. Extract camera and effect ownership

Move camera decisions into `CameraRig`; preserve `BeamCamera` as a composed controller. Then isolate vehicle visual synchronization/effect ownership where it reduces coupling. Keep the working shadow implementation unchanged during extraction.

Acceptance: compare follow/gunner/aerial/beam captures, reduced motion, pad entry/exit and horizon shots. Exercise repeated restart, reinforcement growth and disposal; compare GPU/resource counts without assuming identical counts prove visual correctness.

### 6. Separate audio policy and finish cleanup

Extract music direction and voice ownership, document lifecycle contracts, remove now-unused adapters, and consolidate current design documentation. Retain historical decisions as history. Add focused lint/format checks only after settling conventions; do not churn generated docs or third-party sources manually.

Acceptance: existing spatial/audio tests, pause/mute/reset and Safari unlock checks pass; listening review confirms no sound regression. Review import direction and public APIs. Each extracted object has a clear reason to exist and a small responsibility.

## Verification and stopping rules

Use the existing tests as characterization, not as proof the game is complete. Run targeted tests per extraction, then the full simulation suite and relevant browser checks at integration boundaries. Key coverage includes autoplay/blueprint, ground movement, tactical/hearing isolation, teleporters, beam sequencing, retries/stats/budgets, camera transitions and audio lifecycle.

A refactor stage is done when its ownership boundary is real, behavior is preserved or an intentional change is explicitly documented, and the old competing implementation is removed. Keep compatibility shims temporary and named. Avoid algorithm replacement, broad renaming, balance changes, deployment or a language/framework migration in the same change.

Recommended first implementation: stages 0 and 1, followed by `RouteFollower`. Those directly address the failures already encountered and provide the safest foundation for the remaining cleanup.

## Review validation

On September 22, 2026, `npm test` passed all 215 tests on the current macOS working tree. This establishes the automated baseline for this review; it does not resolve the separately recorded later-maze navigation defect. No new browser or visual checks were run for this documentation-only change. Runtime code was not changed as part of the review.

## Implemented ownership — September 22

`src/main.js` now creates the application and registers disposal. `src/app/game-app.js` composes `GameSession`, `GameLoop`, `InputController`, `HudPresenter`, the development adapter, view, sound, and JEV coordinator. It retains explicit loading/terminal/opening/running/paused/death transitions. The fixed simulation remains 60 Hz; hidden autoplay uses bounded timer catch-up.

`src/levels/scenario.js` constructs explicit worlds from layout, layout seed, run seed, and site count. Session configuration snapshots contain vehicle/encounter, flight, and hearing settings. Browser URL selection lives in `src/game/browser-scenario.js`. Pads, beams, rosters, carrier placement, collision, music visibility, and rendering pools derive from the same world. Restart uses the scenario run seed, including Classic, so a seeded URL is reproducible. Arbitrary spawn authoring is not a new supported API; existing fixture placement remains explicit. `levels/maze.js` and `DEFAULT_WORLD` remain deterministic authored-layout adapters for standalone tests, never a mutable current-world selector.

`GameSession` owns the run and settings. World/settings references are non-enumerable, keeping snapshots serializable. `snapshot()` and development state return detached copies. Tuning uses `configure(group, values)`; the single page view retains its presentation configuration. Ordered updates preserve teleport/hearing boundaries, transfer locking, motors, enemies/carrier, weapons, beam completion, debris contacts and one drained event batch. Physical debris now lives in `src/simulation/debris-physics.js`; presentation borrows the session's physics instance and does not advance or free it.

`Autoplay` composes `AutoplayMission`, perception utilities and `RouteFollower`. The follower alone owns its private route cursor, corner/stop/pass-through semantics, braking/turbo and turn state. Route identity includes world and plan revisions and teleport revision. Reconfirming an option preserves progress. Detached request snapshots and progress diagnostics separate JEV choices from execution. The existing later navigation stall is still open.

`JevClient` coordinates participants and request tickets. `JevTransport` owns HTTP/deadlines/cancellation; `JevRequestPolicy` owns pacing, cooldown and retry state; `JevStats` owns round accounting. `shared/jev-protocol.js`, `jev-errors.js`, and `jev-pricing.js` are browser-safe contracts shared by both relays. Credentials and persistent ledgers remain server-only. Tickets reject obsolete rounds, participants, plans, observations and teleport revisions. Native fetch and timer functions are called through wrappers, avoiding a browser receiver error found during migration. `cancelPending`, `resetScheduling`, `beginRound`, and `dispose` replace ambiguous reset behavior.

`CameraRig` owns camera transitions and composes `BeamCamera`; `View` retains visual synchronization and render passes. A deduplicated scene disposal helper releases GPU resources after subsystem targets. `Sound` owns the AudioContext and one-shots; `MusicDirector` owns the media element, cues and music bus; `RecognizerVoices` owns spatial voices. Borrowed resources are released by their owners. The application/session/audio disposal guards prevent duplicate release.

### Reproduction and verification

Use `/?maze=blueprint&layoutSeed=1982&runSeed=1982` or substitute `authored`. `node scripts/replay-autoplay.mjs` runs a credential-free, enemy-free fixed-step replay and writes `test-results/autoplay-replay.json`, including scenario, route and progress diagnostics. The current replay captures beams at approximately 110, 335 and 665 seconds, then stops after a 20-second hold at 706 seconds. This is diagnostic coverage, not successful completion of all mazes.

`npm test` covers world coexistence, settings isolation, fixed-step/event ownership, loop cancellation, input consumption, route progress, transport errors and receiver binding, policy lifetimes, plus existing gameplay contracts. `npm run test:browser -- --refactor` covers view modes, detached state, pause and repeated restarts. Three resets retained 97 geometries, 28 textures and one AudioContext in Chrome. Additional autoplay, beam camera, portal, music and spatial-audio regressions passed; see Validation for limitations. No pre-refactor pixel baseline or new Safari listening review was captured, so those human acceptance checks remain open.

Prettier is available for the extracted modules via `.prettierrc.json`; legacy modules and generated documentation were not globally reformatted. No ECS, inheritance hierarchy, language migration, or additional physics dependency was introduced.
