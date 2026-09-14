---
title: References
subtitle: Visual direction and source images
---

## Fixed reference studio

Open [Reference studio](http://127.0.0.1:5173/reference.html) with the development server running. Front tank, rear tank, maze overview, wall-detail and driving views place the supplied film frame beside the actual game renderer. An overlay slider helps compare framing. All views share the runtime materials, lighting, floor and maze; only fixed camera placement and overview fog scaling differ.

The Tank front preset now sets independent hull/turret yaw, with the cannon turned about 66 degrees across the hull. Its camera position and framing were adjusted against CLU Close Up, aligning the canopy, badge and lower-left barrel more closely. Other presets reset to their own poses.

The studio is a local development page. Use `node tests/reference.mjs` to capture all five views into test-results/reference. It is not included in the production game bundle.



Reviewed 2026-09-12. The [design conversation](https://chatgpt.com/share/6aa58280-6f74-83e9-a410-aa7c54032fe4) remains the source for the user's priorities. Its rejected generated images are not targets.

## Blueprint trace

[Play the traced maze](http://127.0.0.1:5173/?maze=blueprint) · [Compare top-down](http://127.0.0.1:5173/reference.html?maze=blueprint&shot=blueprint) · [Original maze](http://127.0.0.1:5173/?maze=authored)

The user-supplied Maze Blue Print.png is traced as 20 roof outlines, including concave branches and clipped image-edge shapes. The editable coordinates are in src/levels/blueprint-outlines.js. The image has no dimension labels: 0.8 meters per pixel and 54-meter wall height are provisional choices. Walls cut off by the image are closed at its boundary; unseen continuations are not invented. The blueprint loads by default in-game; the original remains available at /?maze=authored. The reference studio retains its original fixed-camera studies unless a layout is selected explicitly.

The roof uses triangulation of each complete outline. Driving uses the original polygon perimeter; projectile and sight rays use the same triangulated solid, preserving open notches. Both layouts share the existing tank, aircraft AI, materials and wall detailing.

[Open the trace overlay](maze-trace.svg): pale yellow outlines show the hand trace against the source. Regenerate it with `node scripts/trace-blueprint.mjs`.

## Inspected images

| Reference | Provenance | Observations used in this build |
| --- | --- | --- |
| [Tank side/three-quarter image](https://vgpavilion.com/mags/1982/fall/vgp/the-making-of-tron/050a-051a.jpg) | Published with *The Making of Tron*, Video Games Player, Fall 1982; magazine scan hosted by VideoGame Pavilion. Film timestamp not established. | Low, wide body; two large rounded drive pods; shallow upper dome; offset turret; long cannon; dark surfaces with broad blue highlights and restrained warm outlining. |
| [Recognizer frontal image](https://images.squarespace-cdn.com/content/v1/5fbc4a62c2150e62cfcb09aa/4172a3d7-ead3-4c6e-9c5b-bf25f1fa7691/tron%2B3.png) | Film image reproduced in [CultureSlate's article](https://www.cultureslate.com/explained/how-tron-changed-sci-fi-and-predicted-the-futurerozkjaa5ls2x4j3eeagsco95derz8g). Timestamp not established. | Very wide shoulder; central crown; inset trapezoidal front panels; two large legs with inward feet; a substantial empty opening beneath the body. Solid dark surfaces with red/orange edge detail. |

These images were downloaded to temporary storage for visual inspection. They are not bundled as game assets.

## User-supplied film frames — September 12 art pass

The user supplied 15 reference images, including the new Maze Details image, and renamed them descriptively. These are local study references; filenames do not establish film timestamps.

| Frame | Visual evidence |
| --- | --- |
| [Maze Blue Print](images/Maze%20Blue%20Print.png) | Top-down source for the optional traced layout. |
| [Maze Top 1](images/Maze%20Top%201.png) | Broad blue roofs, diagonal tips and dark channels. |
| [Maze Top 2](images/Maze%20Top%202.png) | Additional maze forms and wall faces. |
| [Maze Entrance 1](images/Maze%20Entrance%201.png) | Entry geometry and tank approach. |
| [Maze Entrance 2](images/Maze%20Entrance%202.png) | Grid-to-corridor transition. |
| [Maze Details](images/Maze%20Details.png) | Faint vertical seams, thin blue-gray edge highlights and stepped, angled ledges. |
| [CLU Close Up](images/CLU%20Close%20Up.png) | Cannon, offset canopy, blue highlights and restrained red trim. |
| [CLU POV](images/CLU%20POV.png) | Tank point of view and nearby geometry. |
| [CLU Firing](images/CLU%20Firing.png) | Cannon firing reference. |
| [CLU Persued](images/CLU%20Persued.png) | Pursuit and relative vehicle scale. |
| [Inside Maze](images/Inside%20Maze.png) | Rear/side tank proportions against dark walls and blue floor. |
| [CLU Wall Collision](images/CLU%20Wall%20Collision.png) | Tank and wall contact reference. |
| [Recognizers Decend](images/Recognizers%20Decend.png) | Recognizer approach and underside. |
| [Opening Shot 1](images/Opening%20Shot%201.png) | Terminal/opening reference. |
| [Opening Shot 2](images/Opening%20Shot%202.png) | Terminal/opening reference. |

## Applied changes

The tank and Recognizer now use user-supplied GLB models, with the scales and source credits recorded in [Models](../models/index.html). Tank red trim is subdued; Recognizer trim remains emissive.

The maze preserves the oblique branching slab layout. The new detail pass adds thin, non-glowing blue-gray perimeter/corner lines, sparse tall panel outlines, and shallow lower ledges with sloping highlight faces. Detail follows exposed wall faces; coplanar cell edges are joined to avoid drawing the underlying grid. Relief is cosmetic and at most 0.3 meters deep; the shared slab collision and sight volumes remain unchanged.

The home screen reproduces the two lines in the final terminal still with live blue text, character timing, a carriage-return pause and a faint perspective grid. Enter completes the text, then starts the game; reduced-motion preferences reveal it immediately. The local VT323 font approximates the lettering rather than reproducing an extracted film font.

## Remaining fidelity work

Compare the new browser build against these frames in motion. Materials, barrel supports, underside details, maze layout and camera composition can still be refined. User judgment of resemblance remains the acceptance gate. Exact clip timestamps have not been established.

Application screenshots are in `test-results/`; regenerate them with the browser checks described in the README.


## Open-ended simulation / diagonal slab correction

Maze Top 1 shows long blue masses, dark channels and diagonal shard-like ends. The initial square branching implementation was rejected as too blocky. The current maze keeps a connected topology but stretches and skews the two passage axes and clips exposed slab corners into diagonals. Roofs, wall faces, collision and occlusion share these polygons. The full map is inferred/authored; the supplied overview is perspective-limited and does not establish every hidden passage.

The user estimated upright Recognizer feet/legs at about 30 feet. The current half-scale adapter gives an approximately 9-meter upright leg, about 15-meter total height and 17.5-meter shoulder width. This is a user-guided scale choice, not a verified canonical measurement.

## Recognizer crush animation

The four user-supplied frames in images/recognizer attack animation show the legs turning and sliding inward until the stems meet, with the feet facing outward. The model adapter separates the original GLB triangles at the shoulder seams and animates those parts. The 1.3-second fold and accelerated drop are inferred timing, since these stills do not provide frame timestamps. The existing source model retains its simpler wedge-shaped feet.


Recognizer breakup study: inspected the local video at 106–116 s, including three frames per second across impact and separation. Visible traits are brief warm-white/yellow flashes, large angular body/leg sections separating, tumbling fragments and falling pieces rather than a sustained fireball. Runtime effects use randomized partitions of the actual GLB surfaces; fracture boundaries are procedural and not an exact reconstruction of film geometry.

## Carrier final-shot study

Source supplied by user: `videos/carrier and solar sailer.mp4`, 120.604 seconds, 640 × 290, 30 fps. `images/carrier-tail-study.jpg` samples 112–119.5 seconds at 2 fps, row-major; `images/carrier-beacon-study.jpg` samples 114–115.9 at 10 fps. Red point lights at curved supports and tower corners visibly vary; continuous red outlines remain lit. White hanging lamp pairs appear steady. Cyan/green brightness variation is ambiguous because the viewpoint moves and the objects recede.

Runtime approximation: only small red lamp meshes pulse, about one second per cycle with a 0.34-second envelope (short attack and release); three offset groups avoid synchronized flashing. This is a visual estimate, not a frame-exact recovered animation. White, cyan, green and outline materials remain steady pending clearer evidence.


### Recognizer spotlight stills

User-supplied `images/Recognizer Spotlight/IMG_3514.jpeg` through `IMG_3520.jpeg` show a crown-mounted white/cyan core and diffuse blue-violet halo. IMG_3520 provides the clearest close-up of the front projector. The first procedural rendering uses these colors and soft boundaries. Sweep timing and search behavior are inferred; no video was available to measure them.
