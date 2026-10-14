---
title: Project organization plan
topTitle: TRON
subtitle: Clear ownership for code, assets, references and generated output
---

## Scope

Implementation authorized October 14, including deletion of video references and removal from Git history. Preserve gameplay, existing public URLs, attribution, offline behavior and the current deployment process. Migrate one category per reviewed commit; avoid mixing folder moves with simulation or visual changes. The existing refactoring document covers object ownership; this plan covers repository structure and asset lifecycles.

## Current friction

- Runtime code already has useful boundaries in `src/simulation`, `src/rendering`, `src/audio`, `src/ui` and `src/app`. Keep these rather than introducing an engine framework.
- `src/game` mixes configuration and gameplay helpers. Multiplayer server code imports shared simulation from `src`, so the browser/server dependency boundary is less obvious than its actual responsibilities.
- `public` contains shipped audio, fonts and icons, while `docs/assets`, `docs/models` and `docs/references` contain a mixture of inputs, models, film references and supporting documentation. Some documentation assets are actual runtime dependencies.
- Preview HTML entry points and their source modules live at the root and under different source folders. Tests and scripts form broad flat lists; the package test command enumerates many individual files.
- Generated documentation HTML and indexes are committed beside authored Markdown. `dist` and `test-results` are ignored; other generated/intermediate assets need an explicit ownership map.
- Reference folders have ongoing user reorganizations. Inventory those working changes before any migration; do not infer that a missing file should be deleted from history or replaced.

## Proposed layout

| Location | Responsibility |
| --- | --- |
| `src/app/` | Browser startup, scene selection, lifecycle and input orchestration |
| `src/simulation/`, `src/game/`, `src/levels/` | Keep current layout initially; mark browser-free modules, then consider moving genuinely shared rules/configuration together into `shared/simulation/` |
| `src/rendering/`, `src/audio/`, `src/ui/` | Presentation only; no server or provider dependencies |
| `src/mcp/`, `src/multiplayer/` | Browser feature adapters and transport clients |
| `shared/` | Wire contracts, validation and headless authority; document allowed imports |
| `server/`, `workers/` | Local Node adapters and production Cloudflare adapters |
| `public/assets/{audio,models,fonts,images}/` | Shipped URL-addressable assets; adopt only with URL compatibility and cache migration |
| `assets/source/{models,audio,fonts,images}/` | Editable upstream inputs, conversion metadata and licenses; not copied into production by default |
| `references/{film,design}/` | Visual/sound study material, clearly separate from shipped assets; local-only heavyweight material remains outside normal deployment |
| `tools/{assets,validation,build}/` | Conversion, inspection and build tools; retain script wrappers while commands migrate |
| `tests/{unit,browser,fixtures}/` | Fast invariants, real-browser lifecycle checks and reproducible fixtures |
| `docs/` | Authored plans, source/license catalogs and validation reports, plus the current colvmn generated outputs |
| `dist/`, `test-results/`, `.local/` | Ignored reproducible output and local state |

Do not move `docs/colvmn`: it is an upstream submodule. Keep root Vite entry points until preview-route compatibility is explicitly tested. Leave encrypted credentials and ignored secret handling in place during structural work; never copy secrets into an asset inventory or public documentation.

## Asset catalog

Create one machine-readable manifest with a stable asset ID, category, source path, runtime URL, author, source URL, license/use constraints, credit ID, transformations, conversion command, output hash and deployment policy. Distinguish original source, approved runtime derivative, reference-only material and retired asset. Film-derived content must retain its actual provenance rather than being labeled open source.

Generate inventory/credit reports from the manifest only after reconciling it with current credits. An unused import search is not proof an asset is unused: inspect runtime fetches, CSS URLs, HTML, Worker requests, preview tools, PWA precache and IndexedDB keys. Keep original model backups until the user explicitly approves removing them.

## Migration stages and acceptance

1. **Inventory only.** List tracked/untracked assets, file sizes, duplicates by hash, import/fetch references and shipping rules. Record `npm run build` output size and the precache inventory. Acceptance: every shipped asset has a source and credit record; unresolved provenance stays visible.
2. **Document boundaries.** Add concise directory READMEs, mark generated outputs, and document browser-free shared modules. Acceptance: Node authority imports no DOM, WebGL, browser globals or provider keys; existing tests/build still pass.
3. **Organize tests and tooling.** Move one family at a time and update package scripts/import paths. Use deliberate test discovery that excludes browser scripts from unit runs. Acceptance: test count and coverage remain unchanged, CLI wrappers still work, and artifact paths remain reproducible.
4. **Separate references and source assets.** Resolve the user's in-progress reference moves first; move with Git history intact. Update catalog and converters together. Acceptance: source derivation works from documented inputs; production copy rules omit reference footage and editable masters.
5. **Organize runtime assets.** Move one asset category, retaining old URLs temporarily where necessary. Update hashed imports, fetches, preview pages, subdirectory base paths, IndexedDB versions and PWA cache manifests. Acceptance: no new 404s at `/fun/TRON/`, warm/offline loading works, and previously cached clients recover without losing unrelated data.
6. **Tighten shared code boundaries.** Move the minimum browser-free simulation/configuration needed by both server and client. Avoid a monolithic shared utilities folder. Acceptance: authoritative replay/unit checks, local multiplayer and Worker dry run pass; single-player still loads no multiplayer transport.
7. **Retire compatibility paths.** Remove only after deployed-client cache behavior and links are verified. Keep source/license history. Acceptance: production smoke checks, credits, documentation links and cache upgrades pass; rollback instructions identify the prior release.

For each stage, record moved paths, compatibility aliases, commands, browser/hardware, screenshots where relevant and remaining defects in the implementation plan. Deploy separately from unrelated behavior changes. Do not assume a successful build proves audio, camera feel, rendering or multiplayer latency are unchanged.

## First recommended slice

Start with the asset manifest and directory READMEs, without moving any runtime files. This gives us a trustworthy map and catches accidentally shipped source/reference material before a broader rename. Keep generated documentation beside Markdown for now because colvmn and the documentation copy scripts already depend on that arrangement.

## Implementation — October 14

Stages 1–6 are implemented. Tests now live in `tests/unit` and `tests/browser`; tools live in `tools/assets`, `tools/build` and `tools/validation`. Previous CLI paths forward to the new modules. The authority imports its browser-free simulation/configuration from `shared/simulation`; existing source paths remain forwarding modules.

Runtime imports live in `assets/runtime`, outside Vite public, to preserve content-hashed output filenames. Static URLs use `public/assets`. Original model inputs live in `assets/source`, and still-image references in `references`. All 100 existing user reference renames matched identical content before relocation. Untracked source collections remain untracked and are excluded from the committed catalog.

`assets/catalog.json` records provenance, hashes, conversion tools and unresolved attribution. `assets/path-map.json` retains old asset URLs through development middleware, production aliases and service-worker alias resolution. Production copies only authored/generated documentation and explicitly linked media, rather than recursively shipping source collections. The POV-Ray model license remains included.

At the user's request, all 16 local reference videos were deleted, video extensions are ignored case-insensitively, and video paths were removed from Git history. Extraction scripts retain expected ignored input paths for externally supplied footage; those inputs are no longer bundled. Existing audio derivatives remain unchanged. Hosted caches/LFS retention is outside the rewritten branch history.

Validation on macOS/headless Chromium: 531 unit checks, Worker dry run, PWA offline/range/update checks, two-client multiplayer under delivery jitter, and `/fun/TRON/` production-path smoke checks passed. Initial production output was 1,805,603,712 bytes; the reorganized build is approximately 289 MiB, with approximately 89.7 MiB precached. Final release validation is recorded in the implementation plan. Automated checks do not establish subjective driving or sound quality.

Stage 7 remains deferred: retain compatibility paths for this release until deployed cached clients and links have been reviewed. Never restore a pre-purge commit as a rollback: it would reintroduce video history. Use the rewritten history or revert code changes on the cleaned branch.
