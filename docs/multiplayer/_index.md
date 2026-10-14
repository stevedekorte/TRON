---
title: Multiplayer light cycles
topTitle: TRON
subtitle: Feasibility and a low cost implementation plan
---

## Current local prototype — October 13

The user-selected design is one public, server-authoritative arena, reached through LIGHT CYCLES MULTIPLAYER. Six, nine or twelve cycles compete, with at most three cycles per team. Humans occupy available seats and AI fills the rest; additional humans spectate in a FIFO waiting queue. Surviving humans keep their seats, eliminated humans rejoin the back of the queue, and disconnects release seats. Teams are randomized between matches, with two, three or four teams; enough teams are added to seat up to twelve humans. Countdown expansion preserves the scheduled start time.

The local Vite server hosts the room at `/api/multiplayer`. Production support is prepared as one Cloudflare Durable Object named `public-arena-v1`, using the existing Worker and `MULTIPLAYER_ARENA` binding. The authoritative Worker is deployed and a production-origin WebSocket check confirms advancing snapshots and the three-cycle team cap. The static client is being published with this release. Run `npm run dev`, choose the multiplayer menu, and open another browser window to join the same room. Single-player does not load the multiplayer client or start a multiplayer network loop.

The referee runs the shared simulation at 120 Hz and sends trail-delta snapshots at 20 Hz. Inputs are sequenced and scheduled eight ticks ahead (about 67 ms), with bounded timestamp acceptance. Clients extrapolate motion and predict their pending turns; collision and elimination remain authoritative. There is no rollback yet. A late command takes effect on a future server tick rather than rewriting a collision. This removes browser-host authority advantage but does not make differing network latency equal.

Human cycles carry a thick diagonal stripe, first half black and second half white, on the colored shell. Their roster circles mirror it; your circle has an extra outline. Eliminated circles retain their team outline with transparent interiors. Custom stripe patterns are a possible later addition.

The room stops when empty. Active rounds are bounded to three minutes or 2,048 trail segments, connections to 64, input messages to 512 bytes and 80 per second, with idle and slow-connection limits. An active simulation keeps its server instance awake: exact hosting cost needs measurement. No paid service was purchased. The deployment flag `MULTIPLAYER_ENABLED` can disable access.

Multiplayer does not pause when the window loses focus; held controls clear and input resumes immediately on focus. Escape still opens the return-home confirmation. The controls hint sits below multiplayer status.

### Verification and remaining work

- [x] Seven room tests cover capacity, queues, survivor priority, disconnected seats, team variation, input sequence/timing validation, trail deltas and control timeout.
- [x] Full simulation suite: 511 tests pass, plus a dedicated multiplayer audio regression. Production build and Worker dry run pass.
- [x] Headless Chrome on macOS: two rendered clients and twelve additional WebSocket clients share one twelve-cycle arena; overflow waits, local Return cannot reset the match, and single-player/home does not eagerly load the multiplayer client. Both renderers compile the human stripe without shader errors; inspected their captures.
- [ ] Real two-person play, delayed/jittery connections and close cutoff fairness.
- [x] Authoritative Worker deployed; live production-origin WebSocket snapshots verified.
- [ ] Measured server CPU/bandwidth costs, abuse protection beyond basic connection/input limits, and sustained load.
- [ ] Reconnect identity and seat recovery. Currently a new connection is a new participant; browser tabs are separate players and server restart resets the room.

The earlier browser-host proposal below is retained as an architecture comparison, not the selected implementation. Its private rooms, WebRTC and rollback milestones have not been implemented. Pricing references in that proposal were checked October 13, 2026.

## Why timing matters

The arena currently simulates at 120 Hz and cycles normally travel 38.4 meters per second. One simulation step moves a cycle 0.32 meters. A 50 ms delay means 1.92 meters of travel; 100 ms means 3.84 meters, longer than the 3.6-meter bike. Network delay cannot simply be hidden behind smooth animation when a new wall decides whether someone lives.

Those distances use actual elapsed delay, not automatically the displayed ping. Round-trip time includes both directions; half the ping only approximates one-way delay on a symmetric connection. Jitter buffers and input scheduling add more time. Rendering at 60 fps does not make a delayed turn timely.

Local steering should respond immediately through prediction. Remote steering will sometimes need correction. The difficult case is a late turn that creates a wall across another player's already-predicted path. Reconciliation must include trail geometry and collision outcomes, not just vehicle positions.

## Architecture choices

| Approach | Strength | Main cost or limitation |
| --- | --- | --- |
| Browser host with WebRTC | Minimal server simulation cost; direct connection when possible | Host advantage, host cheating and suspension; TURN sometimes required |
| Authoritative server with WebSockets | Shared referee and simpler connection setup | Active server cost; delayed reliable packets can hold up newer data |
| Deterministic lockstep between peers | Very small input messages | Waiting for inputs delays everyone; exact reproducibility required |
| Peer rollback without a single referee | Immediate local prediction | Harder dispute handling and synchronized trail/death corrections |

Start with host authority, not full peer consensus. The host simulates all players and bots, accepts validated inputs, and broadcasts authoritative snapshots and events. Clients predict their own motion and reconcile against those snapshots. WebRTC is the transport; it does not itself solve fairness or synchronization.

Lockstep needs identical simulation results for identical inputs, and waiting for missing inputs can cause stalls. A fixed timestep alone does not prove determinism across browsers. See Glenn Fiedler's [deterministic lockstep explanation](https://gafferongames.com/post/deterministic_lockstep/).

## First playable prototype

1. Extract a headless arena session around the existing 120 Hz simulation. Preserve swept collision behavior, seeded randomness and stable cycle IDs. Version the simulation and arena data so incompatible clients cannot join.
2. Add private join codes and a two-human room. The host owns any bots. Keep JEV requests asynchronous and outside the synchronization path; record accepted bot decisions if replay needs them.
3. Send timestamped, sequenced turn and throttle inputs, initially batching at 30 Hz. Repeat unacknowledged critical inputs. Send state updates around 20–30 Hz while each client renders independently. Measure before increasing these rates.
4. Keep a short history of complete simulation state plus a trail creation journal. Rewind and replay all affected cycles and trails for accepted late inputs. Start with a bounded 100 ms history as an experiment, not a guaranteed fairness threshold.
5. Separate tentative collision feedback from confirmed elimination. Never award turbo, remove a cycle, or announce a result twice after replay. Define simultaneous collisions by simulation time and a consistent tie policy.
6. Validate input order, plausible timestamp age and legal turn rate. Drop inputs outside the history window rather than allowing arbitrary backdating. Show degraded connection status when corrections become frequent.

Use a reliable control channel for room state, starts and confirmed outcomes. A separate channel can carry disposable latest-state updates. Critical turns still need delivery or repetition and acknowledgments even if their transport is unreliable. Avoid resending the entire growing wall history each frame: send sequenced trail events, periodic checksums and occasional recovery snapshots.

The first prototype should end the room cleanly if its host leaves or suspends. Host migration, spectators, public matchmaking and competitive anti-cheat can wait. A malicious browser host remains trusted in this design; private casual rooms are the appropriate initial scope. Direct peer connections can expose network addresses to peers; relay-only mode trades that exposure for relay traffic.

## Hosting and budget

Use an isolated room/signaling endpoint alongside the existing Worker, with short room expiry and limited joins. Keep only ephemeral room metadata; do not persist every game tick. Issue short-lived TURN credentials on the server, never a permanent service key in the client. Rate-limit room creation and cap simultaneous rooms and relay usage independently of the existing AI endpoints.

Cloudflare lists TURN at $0.05 per outbound GB with a 1,000 GB free allowance; STUN is free. Verify allowance scope and account terms before enabling it. At a hypothetical total metered relay rate of 20 KB/s per room, one room-hour is about 0.072 GB. Actual traffic depends on players, packet overhead and how many connections require relaying. [TURN pricing FAQ](https://developers.cloudflare.com/realtime/turn/faq/).

For an authoritative Durable Object alternative, the paid plan includes 400,000 GB-seconds monthly and one million requests. Active objects are charged at 0.128 GB; incoming WebSocket messages use a 20:1 billing ratio. Extra duration is $12.50 per million GB-seconds, rounded up; the paid baseline is $5 monthly. An active simulation must not be budgeted as an idle hibernating lobby. [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Illustrative calculation: 100 room-hours consume 46,080 GB-seconds. Four clients each sending 30 messages/second produce 2.16 million billable request equivalents over those hours. This excludes joins, other Worker traffic, storage and existing account usage. These are planning calculations, not measured game costs. A small fixed-price server is another option if sustained usage grows, but adds maintenance and regional deployment work.

The cheapest practical first version should mostly pay for signaling and occasional relay traffic, with simulation on the host. Set application admission limits before any public launch; billing alerts alone do not enforce a spending ceiling.

## Acceptance gates

- [ ] Replay identical recorded inputs and compare complete state hashes, including trails, random state and confirmed deaths. Test Chromium, Safari and Firefox; if deterministic replay diverges, use authoritative state restoration rather than assuming lockstep safety.
- [ ] Test 20, 50, 100, 150 and 250 ms round trips, variable jitter, and 0%, 1% and 3% packet loss, in both direct and relayed connections.
- [ ] Test mutual cutoffs, simultaneous turns, trail crossings, disconnects, host suspension, late duplicate inputs and round restart.
- [ ] Measure input-to-visible-turn latency, rollback time, corrections per minute, reversals of apparent deaths and bandwidth. Review captures and actual two-person play; smooth rendering alone is insufficient.
- [ ] Keep 60 fps rendering on the target laptops while replay runs. Confirm the normal single-player path loads no multiplayer transport or background network loop.
- [ ] Decide an acceptable latency band from playtests. If even nearby play produces frequent unfair-looking deaths, try a small equal input delay and compare, or move authority to a nearby server before adding more players.

Expand to four humans only after two-player cutoffs feel convincing. The goal is satisfying casual play at low cost, not a promise that intercontinental close-contact racing can feel identical to local play.
