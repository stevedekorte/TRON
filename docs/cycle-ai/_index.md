---
title: Fast, compelling cycle AI
topTitle: TRON
subtitle: Bounded JavaScript tactics, resource planning, and measured evolution
---

## Implemented locally — October 14

The first bounded controller is implemented and enabled by default for multiplayer and the initially unbreached standalone arena. It is plain shared JavaScript: no service requests, inference library or background training. The previous controller remains available with `race.aiMode = 'classic'`; exterior/open-arena behavior stays on the existing controller unless explicitly overridden for development. No production deployment is part of this implementation request.

Implemented behavior:

- One scheduled bot decision per 120 Hz tick for ordinary sequential IDs, each bot planning at 10 Hz; the hard ceiling is two plans per tick. A short safety guard runs every tick. Human seats are untouched, commands are applied after all bot observations, and the six-tick turn cooldown uses simulation time even across partial resource-exhaustion steps.
- A shared, fixed-capacity trail index uses the actual trimmed/damaged/expired collision segments. Queries cap work and treat overflow as unknown/blocked. The index currently rebuilds each step; measured cost fits the reference-machine gate, so incremental maintenance is deferred rather than adding invalidation complexity prematurely.
- Nine joint heading/pedal candidates. The speed forecast shares the authority's response formula and step order; arrival checks account for acceleration, available charge and an opponent's possible turbo response. Cutoffs require an arrival lead and an exit. Closing a confined approach earns more than crossing open space. Brake/yield and resource-conserving coast options compete with turbo.
- Stable target selection and switching penalties, plus seeded choice only among safe near-best candidates. Planning flood fills share a 255-cell limit across the three directions. Full two-turn search, explicit multi-bot role reservations and learned opponent prediction are not implemented yet.
- Versioned bounded scoring weights, an offline evolutionary tournament tool, and an optional 32→16→1 neural residual scorer. Neural output is capped and cannot bypass safety. The shipped policy is the linear scorer; no evolved or neural weights have been promoted.
- Local development controls in TAB → Arena AI, plus `__tron.configureCycleAI({mode:'bounded', measure:true})` and `__tron.cycleAI` diagnostics. The latter includes decision/guard counts and cumulative AI milliseconds. Multiplayer AI remains authority-owned; the client panel cannot edit it. Settings apply to the current local arena, persist across its rounds, and are not saved globally.

### Verification and reproducible commands

Reference machine: Apple M2 Max, macOS, Node v22.22.0; headless Chrome 155 at 1280×800. These measurements are not server-runtime or low-end-device guarantees.

| Check | Result |
| --- | --- |
| `node tools/ai/benchmark.mjs classic 3 180` | Existing full-tick p99 approximately 1.80–1.82 ms across seeds 1982–1984; matches ended in 35–69 simulated seconds |
| Initial all-bounded full matches | Full-tick p99 approximately 0.38–0.57 ms; several matches reached the 180-second horizon, so stalling/endgame variety still needs play review |
| `node tools/ai/stress.mjs` | Twelve bots and 2,048 changing segments: AI p95 0.262 ms, p99 0.493 ms, max 0.867 ms; no index overflow |
| `node tools/ai/stress.mjs --crowded` | Same history with twelve nearby threats: AI p95 0.399 ms, p99 0.487 ms, max 0.871 ms |
| `node tools/ai/compare.mjs 3` | New team won 9/12 matches against three classic teams, rotating through all four spawn teams for seeds 2200–2202. No draws. A small correlated sample, not a statistically established general win-rate gain |
| `node tests/browser/cycle-ai.mjs` | Local arena/tuning work without page errors; dense browser AI p99 0.4 ms. Actual AI work accumulated per rendered frame: p99 0.4 ms across 481 frames; max 0.7 ms. The rendered test has five AI cycles; the separate dense test has twelve |
| `npm run build` / `npm run worker:check` | Production build/asset audit and Worker dry run pass; no deployment |
| `node tests/multiplayer-browser.mjs` | Two rendered clients, twelve-cycle arena, fourteen connections, queue and restart/lifecycle checks passed |
| `node tools/ai/evolve.mjs --smoke` and `--smoke --neural` | Linear and neural candidate tournament pipelines run and emit a review artifact; short 15-second smoke matches all timed out. No claimed learning improvement or policy promotion |
| `npm test` | 550 tests pass, including collision/expiration/overflow, deterministic decisions, human isolation, policy bounds, neural safety mask, speed/resource forecast, turbo cutoff, brake/yield, turn cooldown and containment fixtures |

Run `node tools/ai/evolve.mjs` for the full offline linear experiment, or append `--neural` for the optional network experiment. It writes `test-results/cycle-ai-candidate.json`, never edits the shipped policy and never trains during play. Full runs intentionally cost more than the smoke check: multiple generations, spawn rotations and a held-out suite. Inspect performance and match results, run scenario checks and human review before importing `artifact.policy` through the development helper or changing the default policy in source. The reported Wilson interval is exploratory: spawn rotations share seeds and are correlated; it is not a sufficient promotion test by itself.

Remaining release-quality evidence: slower devices, actual deployed authority CPU/tick debt, long dense-history full-collision matches, larger held-out tournaments, and real-player impressions of aggression and endgame pacing. CPU timings below the gate do not prove that every overload fallback is strategically good. Geometry saturation stays conservative and can cost a bot an escape. No automated check establishes that the bots are already compelling to human players.

The staged design below remains the longer-term target; unchecked advanced stages are not represented as completed by this first controller.

## Decision and priorities

Design a plain-JavaScript arena AI that wins through positioning, timing and resource use. **Runtime performance is the first priority.** Add intelligence only when it fits the measured budget. The implementation status above distinguishes completed work from the remaining design; this page does not authorize deployment.

Priority order:

1. Keep simulation ticks and rendered frames smooth with twelve cycles and long trail histories.
2. Remain competent: avoid preventable crashes, preserve exits, obey the same movement and resource rules as players.
3. Act aggressively: cut off opponents, take their escape lanes and cooperate to box them in.
4. Use turbo and brake to change an encounter's outcome, conserving charge when spending it provides little benefit.
5. Vary strong decisions without randomly choosing bad moves.

Optional progression: evolve a compact parameter set using controlled win-rate experiments. Trial a tiny neural scorer only if it improves play under the same performance and safety gates. No JEV calls, model downloads, GPU inference or training in the game loop. JEV for tanks/Recognizers is outside this change.

## Current implementation and integration boundary

The authoritative movement and AI currently meet in `shared/simulation/light-cycles.js`. `chooseCycleDirection` compares forward/left/right using clearance, bounded flood-fill space, nearby cycles, a bias toward opponents' forward lanes, optional `jevGoal`, and small random score noise. Turbo/brake decisions then use clearance thresholds. AI decisions run on sampled reaction intervals; movement is continuous with bounded 120 Hz steps. The planning occupancy grid has 4.8 m cells; it is not the continuous collision authority.

Reuse the movement, speed response, resource accounting, trail trimming/damage/lifetime and swept collision rules in `shared/simulation/`. Avoid maintaining an approximate second ruleset that can approve a path the real simulation rejects. Extract small shared pure helpers where needed, with parity tests before switching controllers.

Multiplayer runs at 120 Hz with at most twelve cycles and a configured 2,048-trail limit (`shared/multiplayer/config.js`). A tick is about 8.33 ms; that is the budget for the entire authority, not an allowance for each AI. Normal speed is 38.4 m/s, maximum turbo target is 96 m/s, brake target is half normal speed. Turbo/brake each have five seconds of full-charge use and sixty seconds of recharge; acceleration/deceleration are gradual. Trail rewards can change available charge. Read all of these from configuration rather than copy constants into the planner.

Scope the first release to the closed arena in single-player and multiplayer. Preserve the existing exterior-road controller and explicit transitions to/from it. Apply the new controller only to AI-owned cycles, never human seats. Remove cycle-specific JEV goal influence and scheduling only when the replacement passes its gates.

## Performance contract before tactics

The following are **provisional acceptance targets, not measurements**. Stage 1 must establish them on a named reference desktop/browser and the actual server runtime. Include a slower browser/device profile; do not judge speed solely on this development machine.

| Quantity | Initial ceiling or target |
| --- | --- |
| All AI work per authority tick, twelve bots | p95 ≤ 0.5 ms; p99 ≤ 1 ms, including geometry-index maintenance |
| Whole authority tick | p99 < 8.33 ms; no growing tick debt in sustained worst-case matches |
| Browser frame cost attributable to AI | p99 ≤ 1 ms at 60 Hz, including multiple fixed steps per frame; no AI-caused long tasks |
| Tactical planning | At most 2 bots per tick; each bot eligible every 12 ticks (10 Hz), stable ID-based staggering |
| Strategic/target refresh | Every 60 ticks (2 Hz), also staggered |
| Maneuver candidates | At most 12 per tactical decision |
| Detailed candidates/opponent replies | Best 3 candidates; at most 3 plausible replies for the selected threat |
| Local space estimate | At most 256 visited cells per bot decision, shared across candidates |
| Emergency guard | Every simulation tick, short bounded queries for each live bot |

Define additional explicit ceilings for segment tests, rollout steps and index updates in Stage 1. Count work for the **entire tick**, not merely per candidate. Profile a full 180-second match, dense intersections, repeated tight turns, trail retirement, deaths and catch-up bursts. Test the current trail cap and the maximum supported single-player arena history. Report p50/p95/p99/max, decision age, segment-test counts, allocations/GC, frame tails and server tick debt. Measure snapshot/serialization work as well as AI.

Use operation-count limits to choose behavior; wall-clock timing is telemetry, not the normal search termination rule. This makes replays independent of machine speed. If a budget is exhausted, retain a still-valid plan or select a bounded defensive fallback. Never interpret unfinished searches as proof that a corridor is safe. Safety work has reserved capacity; tactics cannot consume it. If even the guard cannot complete its required checks, release turbo and choose the best verified alternative, recording the overload. No fallback can guarantee survival once every route is lost.

Do not run a full flood fill or recursive search every tick. Use reusable typed arrays, generation stamps instead of clearing whole maps, and fixed-capacity candidate/rollout buffers. Avoid per-bot copies of the full race, trail list or occupancy grid. Maintain one shared trail spatial index incrementally; account for active endpoints, removals, damage and death fading. Bound index queries in dense buckets too. Overflow produces conservative uncertainty, never silently missing a barrier. A Web Worker is a later measured option, not the baseline: snapshot copying and delayed answers could erase its benefit.

## Controller structure

Keep a few focused modules under a proposed `shared/simulation/cycle-ai/` directory:

| Module | Responsibility |
| --- | --- |
| `controller.js` | Per-bot plan state, fixed scheduling, emergency guard and legal turn/control output |
| `geometry.js` | Shared local queries, bounded space estimates and index maintenance |
| `maneuvers.js` | Generate a small set of attack, escape and resource-control candidates |
| `evaluate.js` | Safety filtering, short rollouts, features and utility scoring |
| `config.js` | Named units, immutable runtime limits and versioned tunable behavior weights |

A candidate is a compact sequence of at most two turns with trigger ticks/positions, a short turbo/brake/coast schedule, target ID, expected exit and expiration. Internally use meters and seconds, converting at the adapter to existing cell-coordinate state. Execute only the next committed control, then reassess. Do not expose future AI plans as public opponent intent.

All bots planning on a tick read the same pre-command observation; apply controls afterward. Use stable ID ordering for tie resolution so array order does not create an accidental advantage. Bots may observe arena geometry and public cycle pose/control/resource information. They must not inspect human pending inputs, future AI commands or hidden private intent. For fair difficulty, record perception/reaction cadence explicitly; the emergency guard is a bounded reflex, not a license to react to unseen commands. Keep turn cooldown and speed/resource limits equal to the relevant player rules.

Split cheap danger handling from planning. Each tick checks the current short swept corridor and plan validity. It can cancel turbo, brake when that actually helps, or execute a previously validated escape. Tactical planning selects the next maneuver. Strategic planning picks a useful opponent/region and, later, complementary team roles. Keep target and maneuver hysteresis so tiny score changes do not cause aimless turn oscillations.

## Aggression that creates pressure

Generate candidates from geometry rather than random action trees:

- **Cross ahead:** identify an intersection with the opponent's likely route; reach it early enough to establish a trail, then turn into a verified exit. Cancel when the opponent can arrive first or the crossing traps the attacker.
- **Overtake and cut across:** in a parallel race, test whether a short turbo burst earns enough lead for the rear emitter/trail to block the other lane. Being slightly ahead with the bike's nose is insufficient.
- **Seal an exit:** use an existing wall/trail as one side of a trap; draw the missing boundary while keeping an exit for oneself. Reward reducing the opponent's reachable choices, not merely approaching it.
- **Pressure into a pocket:** take an open lane that leaves the target choosing between increasingly confined regions. Distinguish useful containment from following behind an opponent's barrier.
- **Brake to reverse the advantage:** let an opponent cross first when braking opens a safe follow-through or defeats its cutoff; resume normal speed as soon as the timing advantage is secured.
- **Disengage and preserve space:** abandon an attack whose escape is lost. Keep an available-space maneuver in every candidate set.

For each attack, compare arrival times under the real acceleration and reserve rules. Check when the emitted trail actually occupies the crossing, continuous body clearance and a safety margin for opponent response. Evaluate a small reply set: continued motion, a legal escape turn, and a relevant speed response. Select replies from nearby threats, using conservative motion envelopes for others. A full twelve-agent minimax search is explicitly out of scope.

Use a coarse occupancy/region estimate to rank promising routes, followed by continuous swept checks for finalists and the executed prefix. Include the attacker's newly emitted trail in rollouts: a two-turn maneuver can cut off its own exit. Model known trail expiration, shortening and damage; never count a barrier as already gone just because it is visually fading. A confirmed opponent turn invalidates its old motion forecast immediately, while expensive replanning remains scheduled and bounded.

Score opponent escape loss and territory advantage alongside personal survival, remaining exits and charge. Use a hard safety filter before scoring, rather than letting a large aggression bonus outweigh a predicted collision. When no safe candidate remains, choose the best survival opportunity and record the failure. Short-horizon verification is not a proof against every future opponent action.

Team coordination is a second-stage feature: assign at most one closer and one exit-denier to a target, with brief reservations for their intended corridors. Teammates stay collision hazards. Penalize redundant pursuit and blocking an ally's escape. Do not assume a human teammate follows the plan, and do not require perfect teammate cooperation for the attacker's own safety.

## Turbo and brake as part of the maneuver

Evaluate turn and resource choices together. Candidate schedules are short pulses followed by release, not simply “turbo whenever clear.” Integrate actual speed response and charge to compare arrival times; braking reduces speed, it does not instantly stop the cycle.

Spend turbo only when it creates a robust lead, reaches an exit before closure, or materially expands safe territory. Stop boosting once the required lead is achieved. Spend brake to yield a dangerous crossing, avoid entering a closing corridor or change an opponent's cutoff timing; reject braking that only delays an unavoidable impact while sacrificing the escape.

Price reserve use by context. Charge has higher value with nearby threats or few exits, and lower value when an immediate advantageous cutoff is available. Keep a configurable reserve floor for ordinary attacks, overridable for a verified escape or a sufficiently strong finishing opportunity. Test exhausted reserves and rewards; releasing a request matters because recharge depends on requested controls. Apply switching hysteresis to avoid turbo/brake flicker.

## Randomness without deliberate mistakes

Remove independent noise that can promote an inferior unsafe move. First reject unsafe and clearly dominated candidates. Then choose among alternatives within a small normalized utility tolerance of the best, provided each meets the same clearance, exit and reserve constraints. With only one strong move, take it deterministically.

Sample modest personality preferences once per round: cutoff preference, target stickiness, resource conservation, desired open space and preferred side in symmetric situations. Keep safety margins and computational ceilings outside this variation. Maintain commitment until invalidation or a materially better option appears; do not resample every frame.

Use an independent seeded PRNG stream per bot, round and policy version. A different bot's death must not consume this bot's random sequence. Replay the same seed, policy and observed inputs identically on the same supported runtime. Cross-engine bit-identical floating-point behavior is a separate test requirement, not a promise. Multiplayer remains server-authoritative; clients do not need to reproduce AI decisions to render them smoothly.

## Optional evolution from win rates

Begin with approximately 8–12 bounded parameters: cutoff reward, containment reward, space value, reserve price, attack reserve floor, timing margin above the hard minimum, target-switch cost, commitment duration and near-best selection tolerance. Separate these from non-evolvable safety minima, reaction rules and runtime ceilings. Store a versioned JSON policy with parameter bounds, training seeds, benchmark results and parent policy ID.

Run a plain Node.js headless tournament outside live matches. Mutate a small population around the champion, evaluate cheaply to reject poor candidates, then spend more trials on promising challengers. Use paired seeds with swapped spawn locations, team colors and teammates. Compare against the frozen current bot, several historical champions, defensive and aggressive opponents, plus mixed-policy teams. Separate duel and six/nine/twelve-cycle results. Rotate a held-out seed pool and keep the final promotion suite unseen during optimization.

Rank performance lexicographically: runtime gate, safety regression gate, then team win rate. Record draws/timeouts explicitly, treat the whole match as the statistical unit, and report sample counts and uncertainty. Do not promote on a handful of wins or repeated testing against the same seeds. Require a prespecified statistically supported improvement on held-out matches and no material regression in scenario failures, resource efficiency or performance tails. Keep diverse historical opponents to discourage cyclic overfitting. Human play review remains necessary: higher win rate can still mean dull stalling.

Public win rates are useful monitoring data, but depend on human skill, seats and teammate composition. Do not directly update weights after each public win/loss. Collect policy-tagged results, use them to identify weaknesses, validate a challenger offline, and activate a frozen approved version between matches with rollback available. Never mutate behavior midway through a match. Keep training opt-in and off the browser/server simulation loop.

## Optional tiny neural scorer

A small network is appropriate to **rank validated candidates**, not to replace collision checking or invent arbitrary controls. First establish the linear weighted scorer and evolutionary tuning baseline. Only keep the network if a controlled comparison earns its extra complexity under the same total decision budget.

Initial experiment: 32 normalized candidate features → 16 ReLU hidden units → 1 utility output. This is 528 weighted multiply-adds and 17 biases per candidate, or 545 float32 parameters (2,180 raw weight bytes). With twelve candidates it requires 6,336 weighted multiply-adds per decision. These are operation counts, not timing claims; feature extraction, geometric queries and rollouts can cost more than inference.

Implement inference with fixed typed arrays and ordinary JavaScript loops. No tensor framework, WebGPU, WASM runtime or additional download is required. Clamp/validate inputs and outputs; a non-finite score falls back to the linear scorer. Keep candidate generation, safety masks, resource rules, scheduling and deterministic PRNG outside the network.

Features should describe the candidate rather than a raw arena image: verified clearance/time-to-impact, own exit count, bounded reachable space, target escape reduction, crossing arrival margin, nearby threat distances/headings, current and predicted reserves, speed-control cost, ally interference and plan-switch cost. Include truncation/uncertainty flags so a capped space estimate is not treated as complete information. Features must use only permitted observations and have documented scales. The compressed view can miss global traps; the neural scorer does not remove that limitation.

Train and evaluate outside live play. A first experiment can use bounded weight mutation and tournament selection; compare its sample cost with evolving the smaller linear parameter set. Another option is offline supervised fitting to stronger bounded-search labels, followed by actual match evaluation. A score trained from match outcomes is not automatically a calibrated win probability. Do not call improved imitation loss improved gameplay without tournament evidence.

Version features, architecture and weights together. Benchmark linear and neural scorers with identical candidate sets, seeds and runtime ceilings; measure complete AI cost, not inference alone. Keep the linear policy if neural gains are inconclusive. The hybrid idea has precedent in [Stockfish's neural evaluation](https://stockfishchess.org/blog/2020/introducing-nnue-evaluation/); its results and specialized NNUE architecture are not evidence that a network will improve TRON.

## Implementation stages and acceptance gates

### 1. Establish the budget and baseline

- [x] Add a headless seeded tournament/performance harness and fixed encounter fixtures, retaining the classic baseline.
- [ ] Measure current twelve-bot full matches, near-cap trail histories, simultaneous threats and browser frame tails on named hardware/runtime versions.
- [ ] Specify segment-test, rollout and whole-tick operation ceilings; verify deterministic budget exhaustion and bounded memory. Ratify or tighten the provisional timing targets.
- [ ] Record win rates, unforced crashes, attack opportunities attempted/completed, resource spent per useful maneuver and timeouts. Separate performance timing runs from debug overlays/logging.

### 2. Ship a bounded competent controller behind a flag

- [ ] Extract rule helpers with parity tests; add shared spatial queries and staggered planning with emergency guard.
- [ ] Add escape/open-space candidates, explicit continuous validation and resource-aware timing. Test off-grid turns and speed changes.
- [ ] Pass runtime gates before adding attack search. Validate reset/death/round changes and release all controller/index state correctly.

### 3. Add attack maneuvers and controlled variety

- [ ] Add cross-ahead, overtake/cutoff, seal-exit and brake/yield fixtures, including adversarial replies and abort conditions.
- [ ] Test equal-arrival crossings, own-trail traps, fading/damaged/trimmed trails, multiple threats, depleted charge and a lost exit immediately after commitment.
- [x] Add near-best seeded choice with fixed policy preferences and safety filtering. Per-round personality sampling remains deferred.
- [ ] Add complementary teammate roles only if individual tactics fit the budget. Test ally obstruction and uncooperative human teammates.
- [ ] Compare against the frozen baseline with paired seeds; inspect rendered matches for readable attacks, competent escapes and absence of jitter/stalling. Repeat runtime gates with all tactics enabled.

### 4. Evolve parameters; optionally compare a neural scorer

- [x] Implement versioned policies and offline challenger tournaments with runtime checks and held-out matches. Automatic promotion is disabled; paired statistical and scenario review remain required.
- [ ] Demonstrate a repeatable team-win-rate improvement with uncertainty reported; retain historical opponents and rollback policy.
- [ ] Optionally implement the 32→16→1 scorer and compare it fairly with the tuned linear baseline. Reject it if it fails the same runtime gate or lacks meaningful gameplay gains.

### 5. Integrate and validate release readiness

- [x] Use the same controller in the local initially unbreached arena and multiplayer authority; keep client prediction/rendering separate.
- [x] Disable cycle JEV goal requests/influence for the new mode; preserve tank/Recognizer JEV behavior and the exterior cycle controller.
- [ ] Run unit/parity/replay tests, browser lifecycle checks, sustained authority load and multiplayer tests with human and AI seats. Confirm no added startup or frame hitching from policy/index setup.
- [ ] Record real-player impressions of cutoff pressure, deaths, turbo/brake intent and variety. Document remaining defects and actual benchmark hardware/results before recommending deployment.

Validation status: implementation measurements and completed checks are recorded above. Unchecked stages remain outstanding, especially cross-device/server benchmarking, advanced coordination, training promotion and human play review.
