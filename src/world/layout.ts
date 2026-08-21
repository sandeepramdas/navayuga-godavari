/**
 * layout.ts — shared world dimensions (1 unit ≈ 1 m).
 * Dam axis runs along X; the Godavari flows +Z (downstream).
 * The visual model is a faithful *diagram* of the head-works, not survey geometry.
 */

export const L = {
  // spillway
  bayCount: 48,
  baySpan: 16,
  pierThickness: 5.5,
  pierLength: 46, // along flow (z)
  pierHeight: 52,
  sillY: 20, // gate sill / ogee crest elevation
  gateRadius: 20, // trunnion-to-skin radius (skin spans ~17 m of the 21 m bay height)
  gateHeight: 21,
  deckY: 55,
  deckThickness: 3.2,

  // derived
  get spillwayWidth(): number {
    return this.bayCount * this.baySpan + (this.bayCount + 1) * this.pierThickness;
  },
  get spillwayLeft(): number {
    return -this.spillwayWidth / 2;
  },
  get spillwayRight(): number {
    return this.spillwayWidth / 2;
  },

  // ECRF dam continues from spillway right end to the right bank
  ecrfStartX: 482,
  ecrfEndX: 1260,
  ecrfHeight: 48,
  ecrfCrestWidth: 14,
  ecrfBaseHalf: 110, // half base width along z

  // cofferdams
  cofferUpZ: -250,
  cofferDownZ: 210,
  cofferHalfLenX: 560,
  cofferHeight: 26,

  // diaphragm wall (under the upstream cofferdam alignment)
  dwallZ: -250,
  dwallHalfLen: 750,
  dwallDepth: 88,
  dwallPanels: 46,

  // powerhouse (left bank, downstream)
  phX: -640,
  phZ: 150,

  // water levels
  riverLevel: 7,
  frlLevel: 45.7,

  // terrain
  terrainW: 4200,
  terrainD: 3000,
  bankStartX: 1300,
} as const;

/** valley terrain height profile — must stay in sync with Terrain.ts displacement */
export function terrainHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  // valley floor 0 → banks rise beyond |x| ~ 1200
  const bank = smoothstep(1150, 1850, ax) * 150 + smoothstep(1500, 2100, ax) * 120;
  // gentle rolling hills far up/downstream
  const roll =
    Math.sin(x * 0.0021 + 1.7) * Math.cos(z * 0.0017 - 0.6) * 9 +
    Math.sin(x * 0.0009 - 0.4) * Math.sin(z * 0.0011 + 2.2) * 14;
  const rollMask = smoothstep(500, 1400, Math.abs(z)) * 0.7 + smoothstep(900, 1800, ax) * 0.5;
  // river channel dip along the middle (z-axis corridor)
  const channel = -6 * (1 - smoothstep(300, 900, ax)) * (1 - smoothstep(120, 620, Math.abs(z)) * 0.35);
  return bank + roll * Math.min(1, rollMask) + channel;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
