# TRON

An open-ended Three.js/WebGL simulation inspired by the 1982 film: explore a diagonal, branching maze while five autonomous Recognizers wander, observe, pursue sightings and search when they lose you. There is no timer, assigned route, capture meter or win/loss screen. All simulation, graphics and audio run in the browser.

## Play locally

Requires Node.js 22.12+ and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Enter completes the typing terminal; Enter again starts the simulation. Reduced-motion preferences reveal the text immediately.

| Control | Action |
| --- | --- |
| W / Up | Accelerate |
| Shift+W | Latch throttle; W cancels |
| S / Down | Brake, then reverse |
| A/D / Left/Right | Steer, including turning in place |
| J / L | Turn turret left / right |
| F | Smoothly level gunner aim with the ground; I/K interrupts |
| Space / left click | Fire; hold to repeat |
| C (hold) | Rear view |
| V | Toggle aerial view |
| P | Toggle stabilized first-person gunner view |
| O | Cycle gunner zoom: 1× / 2× / 4× / 8× |
| I / J / K / L | Gunner aim: up / left / down / right; slower when zoomed |
| Scroll wheel / two-finger scroll | Zoom aerial view (also while paused) |
| Tab | Toggle maze survey; does not reveal aircraft knowledge |
| H | Toggle instruments (hidden by default) |
| Escape | Pause/resume and settings |
| R | Reset Clu and all aircraft |
| M | Mute/unmute |
| T | Ten-second turbo boost (2.5× normal top speed; available once per minute) |
| Shift+T | Development tuning and Recognizer observation diagnostics |

The barrel stays level. Bullets assist only height when the manually aimed cannon aligns with an unobscured Recognizer. Shots and sight lines are blocked by the same diagonal walls that constrain the tank.

Each aircraft begins outside the maze and maintains its own observations. Radio messages are delayed, range-limited copies of sightings; they do not refresh old information. After losing sight, a craft predicts a short continuation of the last observed motion, investigates and searches, then forgets stale sightings. It cannot consult Clu's hidden position. Aircraft use separate spatial audio sources, muffled by intervening slabs.

The maze is a reconstruction study based on the supplied frames, not an exact recovered film map. Models remain procedural; inspected internet replacements are documented but not yet acquired. Recognizer legs are approximately 9 m / 30 ft following the user's scale estimate.

## Build and verification

```sh
npm test
npm run build
npm run preview
```

Production preview: <http://127.0.0.1:4173>. The `dist/` folder is a static site with local fonts and documentation. No backend or external runtime services are needed.

With the dev server running and Google Chrome installed:

```sh
npm run test:browser
npm run test:browser -- --terminal
npm run test:browser -- --soak --duration=180
```

The smoke check exercises entry and branch driving, turret controls, five agents/audio sources, pause, radio/sighting memory, shooting and repeated resets. The sustained test steers through connected passages using actual keyboard events and checks collision, errors and resources. Screenshots/reports go to ignored `test-results/`.

`npm run test:browser -- --lifecycle` checks focus, settings, WebGL failures and production startup; both dev and preview servers must run. `--compat` checks available Playwright Firefox/WebKit executables. Actual Safari verification remains separate.

See [validation](docs/validation/_index.md), [assets](docs/assets/_index.md), [references](docs/references/_index.md), [Goal.md](Goal.md) and [the plan](docs/_index.md).

## Documentation

The plan is `docs/_index.md`. Generate HTML with [colvmn](https://colvmn.dev):

```sh
npm run docs
```

The engine is a local checkout in `docs/colvmn`, installed from <https://github.com/stevedekorte/colvmn> at revision `1b2612e52b3a17d6778785dbdfeeab147af1f941`. To restore it if absent:

```sh
git clone https://github.com/stevedekorte/colvmn.git docs/colvmn
git -C docs/colvmn checkout 1b2612e52b3a17d6778785dbdfeeab147af1f941
npm run docs
```

The project is hosted in the private `stevedekorte/TRON` repository. Clone with submodules:

```sh
git clone --recurse-submodules https://github.com/stevedekorte/TRON.git
```

colvmn is pinned as a Git submodule at the revision above. For an existing checkout, run `git submodule update --init --recursive`.

Visual comparison studio: http://127.0.0.1:5173/reference.html (development server). Four fixed reference views and an overlay slider share the game renderer. Capture them with `node tests/reference.mjs`.

Default traced layout: http://127.0.0.1:5173/?maze=blueprint. The blueprint now loads by default; use /?maze=authored for the original. Compare with the supplied blueprint at /reference.html?maze=blueprint&shot=blueprint; editable pixel outlines live in src/levels/blueprint-outlines.js.

Sound audition: http://127.0.0.1:5173/audio.html. Headphones are useful for the Recognizer flyby. Rebuild extracted samples with `python3 scripts/extract-sfx.py`; source credits and timecodes are in docs/assets/_index.md.

### Website deployment

The dekorte.com Pages workflow checks out the pinned `fun/TRON` revision using its `TRON_DEPLOY_KEY` secret (a read-only deploy key for this repository), runs `npm ci` and `npm run build`, then publishes `dist` at `/fun/TRON/`. Push TRON changes, update the website submodule pointer, and push the website to deploy. The Vite relative base supports both root hosting and subdirectory hosting. `tests/production-path.mjs` checks a static build at that path; set `TRON_URL` to test the live site.

## Isolated Codex and browser tests

Development servers leave the running game intact when source files change.
Refresh the browser when you want to load edits. For automatic reload instead,
start the native server with `TRON_HMR=1 npm run dev`.

The container launcher gives Codex and its subprocesses access to this checkout
without mounting your Mac home directory, SSH agent, or Docker socket. TRON is
the **only host-folder bind mount**, at `/workspace`. Linux dependencies and the
container home (including Codex login and session history) use separate Docker
volumes. The container runs as an unprivileged user, with a read-only image
filesystem, no added capabilities, and private temporary/shared memory. Network
access is enabled for Codex and dependency downloads.

Docker Desktop must be running. From this folder:

```sh
scripts/codex-container build   # Already built during setup; repeat after image changes.
scripts/codex-container login   # One-time Codex device login; follow its browser instructions.
scripts/codex-container         # Start a new Codex session inside the container.
```

Codex runs with `--sandbox danger-full-access --ask-for-approval never` **inside
this container**: Docker supplies the filesystem boundary. The launcher does
not grant those permissions to a Codex process running directly on your Mac.
Existing host sessions and credentials are not copied; `scripts/codex-container
resume --last` resumes the last *container* session after one exists.

Both historical test servers start automatically at container ports 5173 and
5174. During an interactive session or shell, open
<http://127.0.0.1:5183> on your Mac (5184 forwards the second server). These
loopback-only host ports avoid the existing native development server. Exiting
the session removes that container and its servers; source edits, dependencies,
login and history persist. There is no background privileged Docker agent
inside the container.

```sh
scripts/codex-container test                       # Isolation, WebGL, tests, build
scripts/codex-container run node tests/wall-shadow-edges.mjs
scripts/codex-container shell                      # Interactive Linux shell
```

The test command does not require Codex login. Reports and captures are written
to `test-results/` in this checkout. Chromium renders through SwiftShader in the
container; its performance is not representative of native Mac GPU rendering.
The full-game container regressions use reduced motion and lower render scale.
Browser fixtures accept `TRON_BROWSER_CHANNEL`; the container selects bundled
Chromium, while native runs retain Google Chrome as their default.

Image/configuration: `containers/codex/`. The image's Playwright version must
match `package-lock.json`; rebuild if that dependency changes. The entrypoint
refreshes the isolated Linux dependency volume when the package files change.
Do not mount the Docker socket or additional host directories if you want to
preserve the folder-only host-file boundary.

References: [Codex containers](https://learn.chatgpt.com/docs/agent-approvals-security#run-codex-in-dev-containers),
[device authentication](https://learn.chatgpt.com/docs/auth),
[Playwright containers](https://playwright.dev/docs/docker).

### Optional tactical enemies and Jev

Design and API contract: [Jev enemy control](docs/jev/_index.md).

The game now starts in **Tactical + Jev** with the full enemy population (small encounter disabled). To change modes, press **Shift+T**, choose **Enemy AI**, then click **Apply AI and restart**. Your selection persists; earlier experimental preferences are reset once for this new default:

- **Classic** restores the original controller, roster and pursuit reinforcements. It makes no AI requests.
- **Tactical — local** uses oriented, swept aircraft clearance, staged turns/descents and a bounded corridor planner. Units choose withdrawal, regrouping, pressure, wall-side strikes or cover from local scores. It needs no key.
- **Tactical + Jev** gives the same maneuver options, explicit routes and outcome measurements to Jev. The local controller still executes movement and checks collisions. Network failures, expired replies and answers below the confidence threshold retain local control and are labeled in the panel.

The **Small tactical encounter** checkbox starts two Recognizers and one ground tank. Tactical modes disable repeating pursuit reinforcements regardless of roster size. Applying a mode starts a fresh run; the choice persists in local browser settings. Tactical restarts use simulation seed 1982; maze placement remains the layout established for that page session. The expanded **Latest AI decision** panel shows the observation snapshot, route choice, probabilities, acceptance and wall-clock latency. `aiConfidence` is adjustable in tuning (default 0.25); detailed movement constants are in `src/game/tactical.js`.

The local Vite server reads the key from `TYPESAFE_API_KEY` (including `.env.local`) or, if absent, the single raw key in `credentials/Typesafe.txt`. Restart Vite after changing credentials. Both locations are ignored by Git and denied by the development file server. Never put the key in a `VITE_` variable. `.env.example` documents the optional model setting. The existing credential file has been connected; no key needs to be pasted into the game.

Only units whose fresh sighting/radio memory or unknown sound estimate is within one maze length request Jev decisions. Distant or unaware units use local tactics. Enemies hear nearby engines and more distant cannon fire, impacts and explosions; walls muffle sounds and reports carry uncertain bearing/range estimates. Hearing permits investigation, not a confirmed target fix. Range controls are in Shift+T.

Requests go through the same local server at `/api/jev/decision`. Direct browser access was checked: TypeSafe rejected CORS preflights for the tested localhost/127.0.0.1 origins. The relay is therefore required for this browser setup; it sends requests directly to TypeSafe without an additional AI layer. There is one in-flight request, at least 600 ms between starts, a 2.2-second server timeout, and a 1,200-request/hour server budget. The browser retries failures with backoff. No calls are made while paused or in Classic/local mode. Late replies after pause, restart or teleport cannot change a vehicle's active maneuver.

`npm run dev` and `npm run preview` provide the local relay. Public builds set `VITE_JEV_API_BASE` to the Cloudflare Worker URL below. Without that build setting, static hosting falls back to local tactics.

Verification: `node --test tests/tactical.test.js tests/jev.test.js`; `node tests/tactical-browser.mjs` uses a mocked unavailable-provider response and defaults to the isolated server at port 5175 (`TRON_URL` overrides it). `node tests/tactical-browser.mjs --live` additionally permits exactly one real provider request and requires the configured server key. Neither browser test prints or reads the key.


### Public Jev relay (Cloudflare)

The public game is served at https://dekorte.com/fun/TRON/. Its build sets `VITE_JEV_API_BASE=https://tron-jev.tron-canyon-run.workers.dev`; this is a public address, never a credential. Local Vite still uses its own relay by default.

Worker source lives in `workers/jev/`, with configuration in `wrangler.jsonc`. Authenticate with `npx wrangler login --device`, validate with `npm run worker:check`, and deploy with `npm run worker:deploy`. Store or rotate the provider key using `npx wrangler secret put TYPESAFE_API_KEY < credentials/Typesafe.txt`. Subsequent deployments preserve the secret. Cloudflare credentials stay outside the repository; local `.dev.vars` and `.wrangler` files are ignored and denied by Vite.

The website Pages workflow must set the public API base during its Build TRON step. Push this repository, update the website's `fun/TRON` pinned revision, then push the website to publish a new client. Worker changes are deployed separately.

Anonymous access is intentional. Allowed browser origins are dekorte.com and www.dekorte.com. Origin checks are not authentication: a non-browser caller can imitate them. One persistent SQLite Durable Object enforces the spending guard across Worker instances: 1,000 requests and 16 MB of serialized provider input per UTC day, 300 requests per IP per day, 60 per IP per minute, at least 750 ms between requests, one in-flight request per IP and four globally. Failed provider calls consume budget. Daily keyed IP hashes are retained instead of raw addresses; shared networks share an allowance. Client snapshots and secrets are not stored by the budget object.

These are request/byte caps, not a guaranteed dollar cap. Limits are intentionally conservative for an initial public trial. Change the named variables in `wrangler.jsonc` and redeploy to tune them. Set `JEV_ENABLED` to `false` to disable public provider calls. The client honors Retry-After and runs local tactics during errors, rate limits and exhausted allowances. Quotas persist across deploys; do not delete the Durable Object to reset them accidentally.
