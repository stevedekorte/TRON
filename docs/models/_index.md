---
title: Models
subtitle: Imported vehicle sources and runtime adapters
---

Both files were supplied by the user on September 12, 2026 after downloading from Sketchfab. Embedded asset metadata identifies the following sources; original binaries remain unmodified.

| File | Source / author | Terms recorded |
| --- | --- | --- |
| tank_-_tron_1982.glb | [Tank — Tron (1982), arabinowitz](https://sketchfab.com/3d-models/tank-tron-1982-b730d118f54b4a868339a4ddf11e09a7) | Embedded SKETCHFAB Standard; creator description additionally says editorial purposes only. |
| tron_1982_recognizer.glb | [Tron 1982 Recognizer, Shriker1](https://sketchfab.com/3d-models/tron-1982-recognizer-ecb52608275c40a28d7d9dda1aed54f3) | Embedded SKETCHFAB Standard. |

License link from both files: [Sketchfab licenses](https://sketchfab.com/licenses). TRON is Disney's property. This records the supplied files' provenance and creator restrictions, not an independent grant of film rights.

## Runtime modifications

The adapter in src/rendering/models.js bakes the export transforms and uniformly scales both models. The tank is 6.5 meters wide (about 9.37 meters hull length); it faces local -Z. Original polySurface1–13 form the rotating cannon/canopy assembly around the circular base. The barrel remains level; recoil translates the assembly slightly. A muzzle flash is added, with simulation coordinates shared through src/game/tank.js.

Tank armor uses cool-blue specular highlights. Red trim is non-emissive, gold is limited to upward-facing shoulders, and lower side panels remain dark. The white insignia has only minimal emission. Hull and turret cast projected silhouettes onto the floor. The extra rectangular contact-shadow plane has been removed. Recognizer trim retains emission.

Recognizer geometry is shared between five aircraft, with separate materials for independent hit flashes. Uniform normalization gives 15 meters overall height and approximately 18.38 meters width at the existing 0.5 simulation scale. Collision remains a simplified independent volume.

Vite packages both GLBs into local dist/assets URLs. There is no Sketchfab runtime request or account requirement. Startup waits for both models and shows a reload message if either fails.

## Verification

node tests/models.mjs checks muzzle alignment across nine hull/turret combinations, Recognizer scale and independent materials, and writes test-results/imported-models.png for visual inspection. Browser controls and lifecycle checks are recorded in [Validation](../validation/index.html).

Recognizer articulation now splits the Base and Light triangle meshes into a body and two legs at the shoulder seam. Original normals, UVs and materials are retained. Each leg turns 180 degrees around its upright center while sliding inward to form the crush pose. Geometry is shared among aircraft; each has independent pose and hit-flash materials.

## Sark’s carrier

User supplied `TRON CARRIER DAE` on September 13, 2026. The included readme credits JIHS, with original design by Syd Mead, and identifies the model as Sark’s carrier from the 1982 film. Source: [JIHS / TurboSquid](https://www.turbosquid.com/3d-models/3d-tron-1982-carrier-model-1811129). The listing records a Standard license; the supplied folder has a technical readme but no separate license document. Preserve the purchase license with the source archive.

`scripts/prepare-carrier.mjs` converts the untouched Collada file into `tron_1982_carrier.glb` using Three.js ColladaLoader and GLTFExporter in Chrome, repairing relative texture URLs in memory. All seven referenced textures are embedded. Measured export: 77 meshes, 64,519 triangles, 6.86 MB; bounds approximately 1,224.65 × 201.96 × 277.01 meters. Source units and proportions are preserved.

`src/rendering/carrier.js` centers the model and adapts its materials to a dark hull with illuminated trim. It travels along world +X at 24 m/s, center altitude 360 m, starting three times the spawn-to-maze distance ahead of Clu (six maze half-widths), 9,000 m to the left of the initial heading. Motion follows simulation time, so standby freezes it and restart restores the transit. It is scenery with no combat or collision behavior. It continues along its line without wrapping. The camera far plane is 12 km, and the carrier is exempt from ground fog. The standalone `/carrier.html` preview provides orbit, pan and zoom with original materials.

## Localized Recognizer destruction

The nearest posed triangle to the reported projectile impact selects the body, left leg or right leg. Only that section is partitioned into 8–13 randomized surface fragments; both other sections detach as whole pieces with gentler spin and impulses. Folded poses, original trim and inherited velocity are preserved. Every source triangle belongs to one piece. This remains a surface breakup effect, not a solid-volume fracture simulation.

Carrier contrast correction: restored source hull colors and textures, reduced blue emission, and adjusted roughness for directional shading. Applied a small depth offset to the original illuminated trim so coplanar hull surfaces do not hide it. Inspected the revised in-game capture; `npm run test:browser -- --carrier` passed.

Carrier trim balance: softened red paint and emission, increased the original blue trim emission, and added muted blue lines at actual armor boundaries (25-degree edge threshold, excluding coplanar triangle edges). This makes the smaller hull panels readable without raising the hull fill.

Recognizer destruction refinement: the earlier rig grouped the complete upper assembly as one body, so one body hit could fragment crown, crossbar and shoulders together. Breakup now treats crown, crossbar, left shoulder, right shoulder and the two articulated legs as six sections. Only the struck section fragments; the remaining five detach whole. Section boundaries use the source triangle centers, preserving every original triangle.

Clu destruction now uses the same posed-surface breakup system: a stomp hides the intact tank and its projected shadows and scatters randomized tank fragments. Current turret yaw and tank momentum are captured by the destruction event. Shadow geometry and muzzle effects are excluded. Thin blue boundary seams outline tank fragments; red boundary seams outline fractured Recognizer sections. Interior triangle diagonals are excluded. Seams fade and dispose with debris. Restart restores the intact tank.

## Carrier escape shuttle

[Model notes and GLB](carrier-shuttle/index.html) · [Interactive preview](../../shuttle.html). Reference reconstruction from the supplied film stills and escape sequence, with provisional scale and hidden surfaces.

## Grid cloud

[cloud.glb](cloud.glb) contains one complete connected grid cloud extracted from `extra/tron_1982.glb`, with no neighboring cloud fragments. Original cyan emissive material and imported scale are preserved; source transforms are baked to Y-up and the cloud is centered at the origin. It contains 1,046 vertices and 846 triangles and spans approximately 735 × 695 meters in the XZ plane. [Preview](cloud-preview.png).

Source: **Tron 1982** by **jvouillon**, from the source file's embedded metadata: https://sketchfab.com/3d-models/tron-1982-d7b1e9a03bca4bb6aa636b56ae45ec88 — CC BY 4.0. Attribution and modification notes are retained in the exported GLB. Reproduce with `python3 scripts/extract-cloud.py`. The game reuses this asset for its decorative drifting cloud layer.

## Solar Sailer — September 22

Source: `extra/TRON_SUNSHIP DAE/TRON_SUNSHIP.dae`, supplied with seven vehicle textures and the JIHS readme. The original design credits Syd Mead, Jean Giraud (Moebius), and Peter Lloyd. The readme references TurboSquid but does not specify redistribution terms. The source is retained unchanged.

Run `node scripts/prepare-solar-sailer.mjs` with Vite on port 5173 to regenerate `tron_1982_solar_sailer.glb`. The browser conversion repairs the source `file://` texture paths in memory and embeds all seven textures. Source geometry has 136,380 triangles; the 162 m overall bound includes a short yellow beam. The adapter hides that beam, anchors the craft on its axis, preserves proportions at uniform 2.5× scale, and orients the sails to lead the +X transit. A fixed amber beam stops at the rear/front hull bounds and resumes on the other side. Materials retain textures with adjusted sky fill and emissive rigging.

Reference reviewed: `docs/references/videos/carrier and solar sailer.mp4`, 1:34–1:46. Film-derived scale and exact visual fidelity remain approximations; this is scenery, not a new combat unit. Lane placement and cadence are named settings in `src/game/solar-sailer.js`.

The first Solar Sailer pass starts at three simulation minutes and repeats every three minutes. Its beam eases in over the three seconds before each crossing and out over nine seconds afterward; both remain absent during the initial quiet period. Pause and restart use the same simulation clock.
