---
title: WebRTC light-cycle matches
topTitle: TRON
subtitle: Revised proposal for review — October 22, 2026
---

## Recommendation and scope

First measure peer connectivity, then build a minimal three-human, player-hosted experiment using reliable ordered WebRTC data channels. Rotate the host and judge the experience of each non-host player. Build private-room infrastructure and experiment with unreliable delivery only after those results justify the work. Keep the public arena server-authoritative and unchanged while measuring whether peer hosting improves responsiveness and reduces infrastructure use. This is a proposal, not an approved implementation or deployment. It does not replace the existing public hosting plan.

Priority order: stable simulation and rendering; responsive and fair play; reliable connections; reduced server cost. Less server traffic alone is not sufficient reason to ship a worse playing experience.

## Primary question: do precise turns become more reliable?

A shorter route may reduce the discrepancy between the turn a player sees locally and the turn the authority accepts. It does not eliminate that discrepancy or establish fairness by itself.

The October 22 code review found:

- `shared/multiplayer/room.js` already separates the simulation authority from its transport. Inputs apply on the next authority tick after receipt; timestamps validate freshness and do not backdate collisions.
- `shared/multiplayer/config.js` specifies 120 Hz simulation and snapshots every four ticks (nominally 30 Hz). `shared/multiplayer/hub.js` pumps at approximately 60 Hz and batches catch-up steps, so a 120 Hz timestep does not promise input service within 8.3 ms.
- Input validation rejects sequences no newer than the last received sequence. Reordering 102 ahead of 101 can therefore discard 101. This is unsuitable for unordered turn delivery without changes.
- Snapshot deltas reference the previous sent baseline, and the decoder requires that exact baseline. They cannot be dropped or reordered safely as currently encoded.

Keep collision rules, input application timing, prediction, and remote playback unchanged in the first experiment. Do not introduce rollback, a new fairness policy, deterministic lockstep, or a new AI policy while evaluating peer hosting.

## Proposed architecture

- Use minimal authenticated HTTPS/WebSocket signaling for the experiment: a test room, participant binding, protocol checks, and exchange of offers/answers and ICE candidates. Defer polished lobby, invitation, and reconnect flows until the gameplay gate passes.
- Configure STUN and TURN together from the start and let ICE evaluate candidate paths within a bounded overall connection timeout. Avoid waiting through a failed direct-only connection attempt before enabling TURN. TURN relays game traffic; do not assume a direct-connection percentage until measured across real networks.
- One player hosts the authoritative simulation. Every participant connects to that host, which runs AI, resolves movement and collisions, owns trails and breaches, and publishes match state. Clients retain local prediction and remote interpolation.
- Use a star topology, not a full mesh. Six humans require five peer connections at the host, rather than fifteen connections across a mesh. AI cycles require simulation work but no peer connections.
- Keep assets served by the existing website. Do not transfer models, audio, credentials, or other large resources through game channels.

Use two peers only for connectivity and protocol smoke checks. The first meaningful gameplay comparison needs three humans plus the normal AI workload, rotating each human through the host role. A two-human test always includes the advantaged host and can overstate the benefit.

In a star, Bob's turn reaches Carol through Bob → host authority → Carol; nearby non-hosts do not automatically get a direct gameplay path. Measure both legs and each participant's result, including a distant host and a host with weak upload. Later scale to six and twelve humans. Exclude public matchmaking, rankings, and large spectator audiences from the initial scope.

## Authority and host execution

Reuse the existing authoritative JavaScript simulation and input rules behind a transport adapter. Inspect the current room implementation before extracting interfaces; avoid duplicating a second physics or AI implementation.

Run host simulation in a dedicated Web Worker so rendering and shader compilation do not directly block its execution. A worker is not an independent machine: CPU contention, battery management, browser suspension, and host network quality still matter. Creating the connection on the main thread is acceptable, but main-thread message handling still gives the path network → main thread → worker → main thread → network. Rendering stalls can delay remote inputs even when the worker keeps stepping. Feature-test transferable RTCDataChannel support in each target browser; where supported, compare channel handling in the dedicated worker against the main-thread bridge. Do not assume specification support establishes browser support. Measure receipt, worker dispatch, application, publication, and render delays separately.

The host's own player must submit inputs through the same validation and sequencing rules. Its network delay is still lower; this proposal does not promise to eliminate host advantage. Do not silently add artificial input delay to hide it.

Select the host explicitly and rotate it for every comparison; identify the role in the test UI. If the experiment succeeds, design host selection around the worst-served participant as well as CPU and upload capacity, rather than lowest average RTT alone. Peer hosts are trusted for casual private play; they cannot provide server-grade cheat resistance.

## Channels and state recovery

For the first game prototype, use reliable ordered delivery for the existing input and snapshot protocol. Keep input ordering and the dependent snapshot stream intact. Acknowledge command outcomes for diagnostics, distinguishing applied, rejected, and superseded control state from mere receipt; do not silently reinterpret existing gameplay rules.

After the gameplay gate passes, evaluate the following as separate changes:

| Information | First prototype | Later experiment |
| --- | --- | --- |
| Motion snapshots | Existing ordered baseline-dependent stream | Independently decodable unreliable updates or acknowledged baselines |
| Turns | Reliable ordered commands | Redundant unordered commands only after an explicit gap/deadline design |
| Turbo/brake | Reliable ordered control state | Repeated current state with sequence protection and release recovery |
| Lifecycle, trails, deaths | Reliable ordered state/events | Reliable sequenced events coordinated with motion revisions |
| Initial state and repair | Reliable bounded transfer | Chunked repair with baseline/event IDs and checksums |

Before enabling unreliable snapshots, implement loss recovery. Do not drop a dependent snapshot and then send a delta based on it. Motion packets must identify the trail/event revision they require; define whether to buffer, defer display, or request repair when that revision is missing. Cross-channel arrival order must not corrupt collision geometry or presentation.

Unordered inputs need a separately reviewed policy for missing sequences: how long to wait, when to reject, and what the client does after rejection. Use consecutive resolved acknowledgments or selective acknowledgments, deduplicate retransmissions, and prevent later commands from silently invalidating earlier turns. Do not replay an old turn arbitrarily after a newer one. A missing release must not leave turbo or brakes engaged.

Use host simulation ticks as the authoritative time reference. Record clock-offset uncertainty and RTT asymmetry limitations; half of RTT is an estimate, not a measurement of one-way latency. Preserve current bounded timestamp validation. Client timestamps do not authorize arbitrary history rewrites.

Bound message sizes, queue depth, and bufferedAmount. With the original dependent stream, handle overload by explicit resynchronization or termination rather than dropping arbitrary deltas. Later independent motion updates may be coalesced before sending. Chunk repairs and bound their bandwidth. WebRTC data channels use SCTP, and channels within one association share congestion control; unordered delivery is not an unconstrained raw UDP socket or isolation from bulk traffic.

## Lifecycle and failure behavior

1. Create/join a private room, validate build/protocol compatibility, and establish peer connections before assigning seats.
2. Confirm assets, initial state, and camera readiness before the existing materialization sequence. Preserve current gameplay timing, sound, roster markings, and team behavior.
3. For the first prototype, a lost participant follows existing disconnect behavior and must explicitly rejoin; do not build seamless reconnection yet. A later private-room release may add bounded reconnect with a room-scoped token, a defined seat policy, and full-state repair.
4. If the host leaves, is suspended, or stops advancing authoritative ticks beyond a configured deadline, abort the experimental match visibly and offer a new room. A socket heartbeat alone is not evidence that simulation is progressing. Bound client prediction during uncertainty; do not silently resume a stalled authority or run a large catch-up burst after suspension. Define the deadline from the scheduling tests before gameplay trials. Seamless host migration is deferred; copying simulation state, AI randomness, event history, and authority safely is a separate project.
5. Let ICE establish a direct or relayed connection using the configured STUN/TURN candidates. If no usable connection is established within the join deadline, explain the failure and offer the existing public arena. Never silently transfer a live match to a different authority.

Mobile backgrounding, sleep, network changes, a closed host tab, and suspended workers must be tested. No user should remain indefinitely on a loading screen.

## Service operation and privacy

Use authenticated room admission, expiring invitation/rejoin tokens, short-lived TURN credentials, connection limits, and rate limits. Do not embed long-lived TURN secrets in the client. Validate every message's size, schema, round, sequence, and assigned player identity.

Direct peer connections can reveal participants' public IP addresses to peers. Explain this for private rooms; a relay-only option can reduce that exposure at the cost of relay bandwidth and an extra network hop. Avoid logging raw connection addresses unnecessarily.

Measure signaling requests and TURN bytes separately from simulation savings. TURN requires bandwidth capacity, abuse protection, monitoring, and region selection. A paid service or new deployment requires separate authorization.

## Alternatives to compare

| Option | Strength | Main limitation |
| --- | --- | --- |
| Existing authoritative server | Stable ownership, public queue, independent authority | Current transport and server route remain |
| Better-region server with existing transport | Isolates hosting improvements with minimal client changes | Still server bandwidth and compute |
| Private WebRTC player host | Potential direct path and less hosted simulation | Host advantage, host device/load, disconnects |
| Dedicated server terminating WebRTC | Datagram-style delivery with independent authority | Requires a compatible backend and operational work |
| Existing proposed WebTransport server path | Another server-authoritative datagram option | Deployment and browser/network fallback requirements |

WebRTC is a transport choice, while peer hosting is an authority choice. Evaluate them separately. Do not assume the current Worker or room host can terminate WebRTC without a new backend component.

## Implementation stages and review gates

### 0. Baseline and acceptance contract

- [x] Review the current authority, scheduler, input ordering, and snapshot dependencies; findings recorded above. No runtime implementation changed during this review.
- [ ] Build reproducible close-wall encounters with an existing wall and no nearby opponent, then separate contested-cutoff encounters. Include normal speed, turbo, braking, and increased grid speed, with the same seeds and AI workload.
- [ ] Record current server results on the same devices and networks. Alternate server and peer-hosted trials and rotate hosts to reduce ordering and device bias.
- [ ] Before evaluating results, agree on numeric limits in the table below. Baseline measurements inform the values, but a relative improvement cannot excuse an unacceptable absolute result. Do not choose thresholds after seeing which transport wins.

| Criterion | Measurement and gate |
| --- | --- |
| Precise turns — primary | Per-player p50/p95/p99 distance between local predicted and authoritative turn positions, divided by authored cycle length; also record predicted-survival/authoritative-death disagreements. Establish an absolute allowable error for each speed regime. |
| Non-host responsiveness | Per non-host input-to-authoritative-confirmation tails and remote input-to-visible-turn latency; require meaningful repeatable improvement over the server on intended networks. Never hide the slowest guest in an average with the host. |
| Correctness | Zero unexplained lost/duplicate turns, persistent state divergence, or incorrect round/trail recovery in the defined test suite. Every command must have a traceable outcome. |
| Scheduling and rendering | Set absolute limits for authority dispatch/tick stalls and client frame stalls at the chosen display target. Track accumulated/discarded time and catch-up bursts, not only average tick duration. |
| Connectivity | Set required join success rate and maximum join time across the declared browser/network matrix; report direct and relayed cases separately. |
| Capacity | Set supported player count, host upload/CPU budget, and maximum tolerated queue growth from measured workloads. |

When the authority rejects a turn or the cycle dies first, record that outcome rather than excluding it from turn-position statistics. Capture distance before collision and the rejection reason where available. Measure local response separately from confirmation; fast prediction alone is not evidence of authoritative improvement.

### 1. Connectivity probe — no game integration

- [ ] Establish peer data channels through minimal access-controlled signaling with STUN/TURN configured together. Keep short-lived relay credentials and message/rate limits even for the test tool.
- [ ] Measure direct/relay selection, join time, RTT distribution, loss behavior, and delivery under bandwidth constraints. Probe representative game-sized messages, not just empty pings.
- [ ] Use three participants to compare each possible host's paths and forced TURN. Record geography/network categories without retaining unnecessary addresses.
- [ ] Stop or revise the approach if the paths are consistently worse than the server or connection reliability is inadequate. A successful probe authorizes no production-room build by itself.

### 2. Minimal three-human gameplay experiment

- [ ] Reuse CycleRoom in a dedicated worker with a small transport adapter; avoid creating a second simulation. Keep the existing public host untouched and preserve its tests.
- [ ] Use reliable ordered channels and the existing snapshot/input semantics. Add only a test-room entry, explicit host selection, readiness, diagnostic reporting, and visible failure handling behind a development flag.
- [ ] Rotate the host across all three participants. Test host rendering stress and a geographically unfavorable host; report every non-host separately.
- [ ] Measure main-thread bridging and worker channel handling where supported. Preserve camera/materialization behavior, sound, and roster cues.
- [ ] Compare precise wall turns and contested cutoffs against the current server. Review results and subjective play before moving on.

### 3. Delivery experiments — only after the gameplay gate

- [ ] Add loss-tolerant motion snapshots and recovery while keeping turns reliable. Compare with the reliable-channel prototype using identical encounters.
- [ ] Consider redundant unordered inputs only if measurements identify reliable input delivery as a material bottleneck. Review gap handling, deadlines, acknowledgment semantics, and rejection feedback before implementing them.
- [ ] Inject packet loss, reordering, jitter, bandwidth limits, clock skew, and interruptions. Test missing baselines, missing trail events, duplicate turns, lost control releases, and old-round packets.
- [ ] Keep transport changes separate from rollback, collision grace, prediction tuning, and host-selection changes so their effects remain attributable.

### 4. Productization and deployment decision

- [ ] Expand to six/twelve humans and representative spectator load. Test Chrome, Safari, Firefox, mobile Safari/Chrome, same-router and separate residential networks, mobile data, restrictive networks, forced TURN, and UDP-blocked paths where available.
- [ ] Test host backgrounding, sleep, low-power mode, network change, and abrupt departure. Validate explicit abort behavior and bounded join/authority timeouts.
- [ ] Only after the earlier gates pass, design the private lobby, invitations, reconnect tokens/seat policy, host selection, and operational monitoring.
- [ ] Review connection success, per-player latency/turn error, host capacity, TURN usage/cost, and subjective play with the user. Do not ship on average RTT improvement alone.
- [ ] If routes improve but player hosting is unstable or unfair, compare dedicated-server WebRTC with the existing WebTransport/server-region alternatives. Do not assume either alternative inherits the peer-host experiment's gains.
- [ ] Preserve a feature flag and a route back to the public arena. Obtain deployment approval separately; no new infrastructure purchases are authorized by this plan.

## Deferred work

Seamless host migration, public peer matchmaking, persistent competitive rankings, full-mesh simulation, deterministic lockstep, rollback, and large spectator services are outside this experiment. Private-room polish and reconnect continuity are deferred until demonstrated gameplay benefit. Updating this document does not approve implementation.

## References

- [WebRTC peer connections, signaling, STUN and TURN](https://webrtc.org/getting-started/peer-connections)
- [RTCDataChannel delivery options](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel)
- [WebRTC data channels and SCTP delivery/congestion behavior — RFC 8831](https://www.rfc-editor.org/rfc/rfc8831.html)
- [WebRTC specification, including transferable RTCDataChannel](https://www.w3.org/TR/webrtc/)
- [Existing multiplayer hosting plan](../index.html)

These references support the transport capabilities. The topology, staging, thresholds, and acceptance criteria above are project proposals, not measured results.
