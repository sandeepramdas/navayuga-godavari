# Navayuga — Building the Godavari

An immersive, scroll-driven Three.js website for **Navayuga Engineering Company Ltd**.
The Polavaram spillway and dam are constructed phase-by-phase as the user scrolls —
diaphragm wall → cofferdams → spillway piers → radial gates → ECRF dam → powerhouse →
golden-hour water release — followed by standard corporate sections.

```bash
npm install
npm run dev      # http://localhost:5188
npm run build    # type-check + production bundle → dist/
npm run preview
```

## ⚠️ Before launch: verify every figure

**Every quantitative claim on this site is a placeholder pending primary-source
verification.** All of them live in ONE file: [`src/data/projectData.ts`](src/data/projectData.ts).
Each stat carries a `verify: true` flag; the UI renders a small `⟨verify⟩` marker
wherever a flagged figure appears (HUD cards, fallback gallery, awards, contact).

Verification priority order:
1. Polavaram Project Authority / AP Water Resources Department official documents
2. PIB / Ministry of Jal Shakti releases
3. Navayuga Engineering's own project pages
4. Reputable press (The Hindu, Economic Times)

Correcting a number is a one-line edit in `projectData.ts` — it propagates to the
3D HUD count-ups, the crawlable HTML (`data-stat` spans synced at boot), and the
reduced-motion gallery. When a stat is confirmed, set `verify: false` and the
markers disappear. Superlatives ("second only to Three Gorges", "deepest diaphragm
wall", record concrete pours) should be sourced to an official record body (CBIP)
before shipping. Also confirm founder name, registered HQ address, careers email
(`data-verify` attributes in `index.html`), and the exact scope wording of
Navayuga's head-works contract — the copy deliberately presents Navayuga as
**head-works contractor**, not sole builder.

## Architecture

```
src/
├── main.ts                 progressive enhancement bootstrap (3 layers, below)
├── data/projectData.ts     ALL stats + copy — single source of truth
├── core/
│   ├── SceneDirector.ts    renderer, world, ONE master GSAP timeline, scroll follower
│   ├── CameraRig.ts        pos/look/fov tweened by timeline; damped look target,
│   │                       layered-sine handheld drift, scroll-velocity FOV kick
│   ├── PostFX.ts           bloom → OutputPass(ACES/sRGB) → grain+vignette
│   ├── Quality.ts          device tiering + rolling-FPS silent degradation
│   └── store.ts            typed pub/sub HUD bridge (zustand pattern, no dep)
├── world/
│   ├── BuildState.ts       the uniform-driven animation state — GSAP tweens ONLY
│   │                       these scalars; modules read them in update()
│   ├── layout.ts           shared dimensions (1 unit ≈ 1 m) + terrain profile
│   ├── materials.ts        concrete (lift bands, staining, noise roughness),
│   │                       painted/bare steel, zoned rockfill
│   ├── Environment.ts      physical Sky → PMREM env (zero-asset IBL), sun/fog,
│   │                       golden-hour sweep, X-ray void mode
│   ├── Terrain.ts          displaced valley, height/slope shading, blueprint X-ray
│   ├── Water.ts            custom shader: layered waves, fresnel, glints, flood foam;
│   │                       3 planes (reservoir / work pit / downstream)
│   ├── Spillway.ts         49 instanced piers, ogee crest, apron, deck, portals
│   ├── Gates.ts            48 radial gates = 2 InstancedMeshes (skin + arms)
│   ├── DiaphragmWall.ts    instanced panels, X-ray descent, 2019–20 setback beat
│   ├── Cofferdams.ts       upper/lower embankments; lower breached before release
│   ├── ECRFDam.ts          clipping-plane lift construction, shell + clay core
│   ├── Powerhouse.ts       pad, hall, intake, penstocks, yard; golden-hour windows
│   ├── Cranes.ts           procedural tower cranes, slewing jibs, cable lag, flags
│   └── Particles.ts        GPU points: dust / welding sparks / spray + birds
└── ui/
    ├── Hud.ts              phase titles, count-up stat cards, milestone chips,
    │                       hazard-stripe construction bar
    └── Loader.ts           blueprint self-draw + % readout
```

### Scroll architecture
One `ScrollTrigger` pins `#experience` for `+=800%`. The trigger only writes a
**target progress**; the render loop advances a damped follower
(`p += (t−p)·(1−0.001^dt)`) and drives the paused master timeline via
`tl.progress(p)` — buttery scrub regardless of input device. Native scroll rate
is never hijacked; Lenis provides inertial smoothing and is synced to the GSAP
ticker. Section ranges live in `projectData.ts` (`sections[i].range`).

### Performance notes
- **Draw calls:** ~40 total (instancing: 49 piers = 1, 48 gate skins = 1, 48 arm
  sets = 1, 46 wall panels = 1; merged geometry everywhere else).
- **Zero per-frame allocations** in update paths (scratch Matrix4/Vector3/Quaternion).
- **Uniform-driven:** GSAP tweens ~18 scalars in `BuildState`; instanced matrices
  are recomputed only when their driving scalar changed (last-value caches).
- **Adaptive quality:** `FpsGovernor` steps high → med → low (pixelRatio, grain,
  bloom, particle counts, shadow map) after 2s sustained < 50 fps.
- Rendering pauses when scrolled past the experience.
- Bundle: ~215 KB gzip JS total (three 127 KB, gsap+lenis 33 KB, app ~55 KB), zero
  downloaded 3D/texture assets — IBL comes from a PMREM-baked procedural sky.
- Tone mapping: ACESFilmic at exposure 0.52 (the physical Sky addon is calibrated
  for ~0.5), graded to 0.72 at golden hour via the master timeline.

### Accessibility / fallbacks
- `prefers-reduced-motion` → static phase gallery with full text + stats and an
  explicit "Play the 3D experience" opt-in.
- No WebGL2 → same gallery, no opt-in.
- All copy and stats exist as crawlable HTML regardless of WebGL state; JSON-LD
  Organization schema; keyboard: native scroll keys work, `End` skips to reveal.
- HUD cards: blurred dark fills keep text ≥ 4.5:1 over any scene content.

## Swapping procedural geometry for real glTF models
The scene is 100% procedural by design (PRD fallback requirement). To replace a
structure with an art asset:
1. Export Draco-compressed `.glb` (crest/pier/gate/crane), KTX2/BasisU textures.
2. Add `GLTFLoader` + `DRACOLoader`/`KTX2Loader` in an `AssetRegistry` module and
   load during the `Loader` phase (wire real progress into `Loader.finish()`).
3. Replace the corresponding `world/*.ts` mesh construction; keep the same
   `update(state)` contract — install/rise animation is driven by `BuildState`
   scalars, not by the geometry source. For gates/piers, put per-instance progress
   in an `InstancedBufferAttribute` if you move the stagger to the vertex shader.
4. Budget: ≤ 8–10 MB gzipped total; textures 2K desktop / 1K mobile.

## React Three Fiber alternative (documented path, not implemented)
The vanilla path was chosen for frame-exact camera control (PRD default). An R3F
port maps 1:1:
- `SceneDirector` → `<Canvas>` + a `<BuildDirector>` component; keep the SAME
  master-timeline + damped-follower pattern inside `useFrame` (do NOT use
  `drei/ScrollControls` — it hijacks scroll; keep Lenis + ScrollTrigger).
- Each `world/*` class → a component reading a shared `useBuildState` zustand
  store; the GSAP timeline tweens the store outside React (no re-renders — mutate
  refs/uniforms, never setState per frame).
- `PostFX` → `@react-three/postprocessing` (`Bloom`, `Noise`, `Vignette`).
- HUD stays plain DOM driven by the same store.

## Deliberate scope notes
- **SSAO** omitted: poor cost/benefit on a large outdoor procedural scene; depth
  is carried by shader-baked staining/AO gradients + soft shadows + fog.
- **Sound** (PRD optional, off by default) not included; add an ambient bed +
  placement thuds behind an unmute toggle, ducked under reduced motion.
- **Contact form** posts nowhere — wire `#enquiry` submit to your CRM endpoint.
- Lighthouse targets (Perf ≥ 85 / A11y ≥ 95 / SEO ≥ 95) should be re-audited on
  the production host with compression + caching headers in place.

## Dev QA hooks
In dev builds, `window.__nav = { director, lenis }`:
```js
__nav.director.scrollToProgress(0.57, { immediate: true }) // jump to any beat
__nav.director.jumpToSection(4)                            // animate to a section
```
