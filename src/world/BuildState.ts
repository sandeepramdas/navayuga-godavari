/**
 * BuildState.ts — the single uniform-driven animation state.
 * The GSAP master timeline tweens ONLY these scalar fields; every world module
 * reads them in update(). No per-object tweening, no per-frame allocation.
 */
export interface BuildState {
  /** S2 blueprint X-ray mode 0..1 */
  xray: number;
  /** diaphragm-wall panel descent 0..1 */
  wall: number;
  /** flood-setback flicker beat (2019–20) 0..1..0 */
  setback: number;
  /** cofferdam embankment rise 0..1 */
  coffer: number;
  /** work-area dewatering 0..1 (1 = dry) */
  dewater: number;
  /** spillway pier rise (staggered per-instance inside Spillway) 0..1 */
  piers: number;
  /** ogee crest + apron slab 0..1 */
  crest: number;
  /** deck + hoist bridge 0..1 */
  deck: number;
  /** radial-gate install wave 0..1 */
  gates: number;
  /** radial-gate opening (S8) 0..1 */
  gateOpen: number;
  /** ECRF dam lift construction 0..1 */
  ecrf: number;
  /** powerhouse assembly 0..1 */
  power: number;
  /** crane fleet presence 0..1 */
  cranes: number;
  /** day → golden hour 0..1 */
  golden: number;
  /** upstream water surface elevation (world m) */
  waterUp: number;
  /** downstream flood energy: foam, turbulence, spray 0..1 */
  flood: number;
  /** particle intensities */
  dust: number;
  sparks: number;
}

export function createBuildState(): BuildState {
  return {
    xray: 0,
    wall: 0,
    setback: 0,
    coffer: 0,
    dewater: 0,
    piers: 0,
    crest: 0,
    deck: 0,
    gates: 0,
    gateOpen: 0,
    ecrf: 0,
    power: 0,
    cranes: 0,
    golden: 0,
    waterUp: 7,
    flood: 0,
    dust: 0,
    sparks: 0,
  };
}
