# Project instructions

## Read first

- Read `Goal.md` for the intended experience and `docs/_index.md` for milestone scope, decisions, and acceptance criteria.
- Preserve the user's direction from the linked conversation: the original 1982 tank/canyon/Recognizer sequence, accurate vehicle proportions, faceted terrain, soft surface gradients, and convincing sound.
- The shared conversation's generated images were criticized by the user. They are not approved visual targets. Use identified original-film references to judge fidelity.

## Implementation conventions

- Use JavaScript ES modules, Three.js with WebGL rendering, and Vite unless implementation evidence warrants a documented change. Start with a static, desktop-browser application.
- Keep simulation, presentation, audio, and authored level data separate. Use a fixed simulation timestep, simple vehicle dynamics, and autonomous information-limited agents.
- Keep tunable values in named configuration objects with units. Provide a development-only tuning panel; avoid scattering magic numbers through systems.
- Use meters, seconds, radians, Y-up, and local vehicle forward along -Z. Normalize imported models in an adapter without changing their intended proportions.
- Prefer a few focused modules over a custom engine, ECS framework, general editor, or heavyweight physics dependency.
- Keep collision shapes independent of visual meshes. Use swept collision or adequate bounded substeps for fast movement.
- Load permitted assets locally. Track source, author, license/use constraints, attribution, and modifications. Label temporary models and sounds as placeholders.
- Prefer suitable existing vehicle models; if unavailable, create reference-based stand-ins behind the same loading interface. Asset availability must not block controller and route work or imply visual fidelity has been achieved.
- Dispose of GPU/audio resources and listeners correctly. Restart must not duplicate the game loop, inputs, enemies, or sounds.

## Work and verification

- Follow the current simulation plan in `docs/_index.md`; the original chase milestones below it are historical. keep milestone checkboxes accurate. Record meaningful changes to assumptions and scope there.
- Complete each milestone's stated checks and record browser/hardware, commands, results, and unresolved defects. Do not claim unrun checks passed.
- Test simulation invariants and browser lifecycle behavior where failures matter. Judge proportions, camera, driving feel, and sound through rendered captures and actual play; automated success alone does not establish these.
- Preserve a reproducible route, configuration, and encounter sequence for comparisons.
- The user now prioritizes an open-ended simulation over structured gameplay. Do not reintroduce timed routes, capture meters, scripted waves or win/loss screens. Preserve manual turret controls and the level barrel. Shots acquired within the narrow turret aim cone now use three-dimensional constant-velocity lead, per the September 13 correction. Recognizer navigation may use its own observations, radio reports and map, never unseen live Clu coordinates.
- Do not treat roadmap entries as authorization to buy assets or publish a deployment. Local implementation and verification can proceed when requested.

## Documentation

- Edit `docs/_index.md` as the plan source, then run `node docs/colvmn/static-gen.js docs` from the project root to regenerate HTML and indexes.
- Treat `docs/index.html`, `docs/llms.txt`, `docs/llms-full.txt`, and `docs/sitemap.xml` as generated outputs.
- Keep upstream colvmn sources separate from project content. Installation and build instructions are in `README.md`.

## Current state

Open-ended simulation replaces the first structured chase as of 2026-09-12. Vite serves the client-only game; Three.js renders imported GLB vehicles and procedural maze geometry and Web Audio plays film-derived stereo vehicle/cannon samples with synthesized fallback and impact effects. Run `npm run dev` for the game, `npm test` for simulation tests, and see `docs/validation/_index.md` for browser coverage and outstanding milestone work. colvmn is installed under `docs/colvmn`.
