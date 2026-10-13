# POV-Ray light cycle — isolated browser experiment

- Model author: **Carl N. Hoff**.
- Retrieved 2026-10-12 from [Jason Cox's lightcycle-povray repository](https://github.com/jasonacox/lightcycle-povray).
- `LightCycle.pov` is the unmodified upstream scene. `LICENSE` is the repository's MIT notice, copyright Jason Cox 2019. The source explicitly credits Hoff for the model.
- The browser adaptation is in `src/experiments/pov-cycle-model.js` and `csg-ray-kernel.js`. It transcribes the source's 54 modeling primitives and CSG union/intersection/difference operations. Shared cutout primitives are evaluated for each affected material part.
- Original +X-forward coordinates are rotated to -Z forward and uniformly scaled from 525 source units to 3.6 meters. Proportions are preserved; the source is narrower than the production mesh.
- Primitives: transformed spheres/ellipsoids, capped cylinders/cones, boxes, half-spaces, nonconvex linear prisms and tori. Tori use quartic stationary points and bracketed polynomial roots, not distance-field ray marching. Other primitives use direct intersections. A sorted boundary sweep applies the CSG expression and orients subtraction normals.
- The upstream scene's lights, reflective floor, trails and six-bike animation are not imported. The experiment uses its own direct vehicle lighting and the production arena's unlit grid constants. Shadow rays are optional. No reflected rays.
- Scope: `raycast-cycle.html` only. Production models and game rendering remain unchanged. This is a GPU adaptation of the geometry, not the POV-Ray application or its scene-language parser.
