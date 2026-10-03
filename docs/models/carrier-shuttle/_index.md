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

## Meshy replacement trials — October 2

The authored model above was rejected by the user for reference mismatch. Meshy candidates are being evaluated against the original film stills, not against the reconstructed `shuttle.png` or wireframe illustration.

- [First Meshy candidate](../../../shuttle.html?model=meshy): four original wide film frames, Meshy 7.1, 2K geometry and textures, approximately 30,000 target triangles. This trial incorporated unwanted carrier detail from the detachment frame and is rejected as a replacement.
- [Focused Meshy candidate](../../../shuttle.html?model=meshy-isolated): the large side view and existing tight film detachment crop only. This trial avoids the carrier but fills in important open sections; it is not an accepted replacement.

Generation uses `scripts/generate-meshy-shuttle.mjs` with `submit`, `status`, and `download`; `--isolated` selects the two-view trial; `--detail` selects only the tight film detachment crop. Each submission is explicit and refuses to overwrite an existing task ID. Credentials are read only from ignored `credentials/Meshy.txt`. No key or signed download URL is recorded in the model metadata. `task.json` records source-image hashes, generation settings, task ID and consumed credits. Models and previews are downloaded locally before the service links expire.

Source images are user-supplied TRON (1982) film references. Meshy supplies generated geometry/materials; this does not establish rights to the original film design. Hidden surfaces and absolute scale remain inferred. The viewer applies a uniform scale to a 20 m longest dimension and preserves generated proportions. No shuttle gameplay behavior is added.

- [Detachment-only candidate](../../../shuttle.html?model=meshy-detail): final trial using only the existing tight film detachment crop. The output is fragmented in both the remeshed and original meshes and is rejected.

All three requests completed at 35 credits each (105 total). Browser checks on macOS Chrome verified loading, six viewing angles and GLB export for the four-view and detachment-only trials, including the original detachment mesh. These technical checks do not establish visual fidelity: none is accepted as a replacement. The existing default model remains unchanged.


## Smoothed symmetric shuttle — October 2

The user accepted the two-view candidate's overall shape and requested smoother lines plus left/right and top/bottom symmetry, superseding the earlier rejection of that silhouette. The default studio now shows its cleaned variant: [open viewer](../../../shuttle.html?model=meshy-clean) · [download GLB](meshy-clean/shuttle.glb).

`src/rendering/shuttle-cleanup.js` welds coincident vertices for smoothing, flattens broad near-axis-aligned panels, clips to one quadrant and mirrors it across the model's X and Y center planes. Creased normals retain harder transitions. A neutral gray material replaces noisy generated textures for this geometry review. Small inferred details remain provisional; the original generated asset is preserved for comparison. The exported model contains 37,000–39,000 triangles. No additional API credits were used.

Chrome browser checks capture six views, verify a mirrored vertex exists across each axis, and export the cleaned GLB. The reference-angle capture was inspected. Geometry symmetry is tested independently of lighting, which can make opposite sides appear different in brightness.


## Flat panels and rounded front corners — October 2 correction

The global smoothing pass was rejected. The current default is an explicit panel reconstruction: [viewer](../../../shuttle.html?model=planar) · [GLB](planar/shuttle.glb). All surfaces and edge intersections are orthogonal except the two quarter-circle front corners. Those alone have smoothly varying surface normals. Width and height remain mirror-symmetric, with straight ribs, a rear center notch and a recessed green front panel. Proportions follow the accepted two-view silhouette; exact fidelity remains subject to visual review.

Source: `src/rendering/shuttle-planar.js`. This supersedes the smoothing approach; prior variants remain available only for comparison. The mesh has 1,532 triangles. A geometry test verifies world-space reflection symmetry and rejects non-axis-aligned faces outside the front corners. Chrome captures all six views and verifies GLB export; the reference-angle capture was inspected.


## Restore the detailed structure — October 2

The flat-panel reconstruction was rejected for removing too much structure. The default is now [the detailed Meshy-based variant](../../../shuttle.html?model=meshy-preserved), with a [separate GLB](meshy-preserved/shuttle.glb). It retains the two-view source's detailed surfaces and material maps rather than substituting simple boxes. Global relaxation is disabled. Only tightly clustered, nearly axis-aligned surface vertices are flattened (0.3% of the relevant dimension), with quadrant mirroring for width/height symmetry. Normal-map intensity is reduced to avoid amplifying generated noise.

The structural detail is restored, but this is a conservative correction—not a claim that every generated edge now has the exact requested hard-surface construction. The earlier whole-body rebuild and global smoothing variants remain available for comparison. Chrome checks pass for mirror correspondence, six-view captures and export; the reference and top captures were inspected. No API credits used.
