/**
 * Quality.ts — device tiering + rolling-FPS adaptive degradation.
 * Steps down silently when sustained FPS < 50: pixelRatio → grain off → bloom off → particles ÷2.
 */

export type Tier = 'high' | 'med' | 'low';

export interface QualitySettings {
  tier: Tier;
  pixelRatio: number;
  bloom: boolean;
  grain: boolean;
  shadowMapSize: number;
  particleScale: number; // multiplier on particle counts
  terrainSegments: number;
}

export function detectTier(): Tier {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const smallScreen = Math.min(innerWidth, innerHeight) < 720;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if ((coarse && smallScreen) || (mem !== undefined && mem <= 4)) return 'med';
  return 'high';
}

export function settingsFor(tier: Tier): QualitySettings {
  switch (tier) {
    case 'high':
      return {
        tier,
        pixelRatio: Math.min(devicePixelRatio, 2),
        bloom: true,
        grain: true,
        shadowMapSize: 2048,
        particleScale: 1,
        terrainSegments: 200,
      };
    case 'med':
      return {
        tier,
        pixelRatio: Math.min(devicePixelRatio, 1.5),
        bloom: true,
        grain: false,
        shadowMapSize: 1024,
        particleScale: 0.5,
        terrainSegments: 128,
      };
    case 'low':
      return {
        tier,
        pixelRatio: 1,
        bloom: false,
        grain: false,
        shadowMapSize: 1024,
        particleScale: 0.3,
        terrainSegments: 96,
      };
  }
}

/** Rolling FPS monitor; calls onDegrade at most once per threshold breach. */
export class FpsGovernor {
  private samples = 0;
  private accum = 0;
  private badTime = 0;
  private stepsLeft: Tier[] = [];

  constructor(
    start: Tier,
    private onDegrade: (next: Tier) => void
  ) {
    this.stepsLeft = start === 'high' ? ['med', 'low'] : start === 'med' ? ['low'] : [];
  }

  tick(dt: number): void {
    if (this.stepsLeft.length === 0 || dt <= 0) return;
    this.accum += dt;
    this.samples++;
    if (this.accum >= 0.5) {
      const fps = this.samples / this.accum;
      this.badTime = fps < 50 ? this.badTime + this.accum : 0;
      this.accum = 0;
      this.samples = 0;
      if (this.badTime >= 2) {
        this.badTime = 0;
        const next = this.stepsLeft.shift();
        if (next) this.onDegrade(next);
      }
    }
  }
}
