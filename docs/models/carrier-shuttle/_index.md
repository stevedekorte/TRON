---
title: Carrier escape shuttle
topTitle: TRON
subtitle: Reference reconstruction of the carrier escape pod
---

[Open the interactive model studio](../../../shuttle.html) · [Download the GLB](carrier-escape-shuttle.glb)

## Model

A locally authored, faceted Three.js model based on the supplied TRON (1982) stills and the escape sequence in `MCP destroyed.mp4`, 2:34–2:57. The studio supports orbit, zoom, fixed detachment/reference/side/top/rear/underside views, a turntable and GLB export. This is a standalone asset, with no new game behavior attached.

The revised model uses an open asymmetric shell: two ribbed overhead surfaces, two downward-hanging end blades, a single outer side wall with a recessed green panel, and a narrow connecting saddle. The first solid-pontoon interpretation was rejected in comparison with the detachment still. Materials are assigned directly to geometry, avoiding dependence on external textures. Source: `src/rendering/carrier-shuttle.js`; preview: `shuttle.html`.

The 20 × 14 × 9 m envelope is provisional. Absolute dimensions, internal saddle details, side-wall thickness and forward-axis assignment remain inferred. This is a reference reconstruction, not a recovered original film model. These areas should be revisited as more views become available.

## Supplied references

- [Side / three-quarter](../../references/images/Carrier%20Escape%20Pod/Escapepodside.webp)
- [Top](../../references/images/Carrier%20Escape%20Pod/Escapepodtop.webp)
- [Back](../../references/images/Carrier%20Escape%20Pod/Escapepodback.webp)
- [Detachment](../../references/images/Carrier%20Escape%20Pod/Escapepoddetach.webp)
- [MCP destroyed clip](../../references/videos/MCP%20destroyed.mp4), 2:34–2:57

User-supplied film references; personal project. Geometry authored for this project from those references. The GLB embeds its source and provisional reconstruction notes in scene metadata.

September 18 orientation correction: the shell opens downward, and the ribbed surfaces are viewed from below. Reference and detachment cameras look upward; the principal light and hemisphere fill now come from below. The exported GLB includes the corrected orientation.
