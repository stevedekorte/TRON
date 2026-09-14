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
| F | Smoothly center turret; J/L interrupts |
| Space / left click | Fire; hold to repeat |
| C (hold) | Rear view |
| V | Toggle aerial view |
| P | Toggle stabilized first-person gunner view |
| O | Cycle gunner zoom: 1× / 2× / 4× |
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
