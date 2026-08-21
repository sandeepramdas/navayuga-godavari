/**
 * store.ts — minimal typed pub/sub bridging the 3D world → DOM HUD.
 * (zustand-pattern without the dependency; single mutable state + subscribers.)
 */

export interface HudState {
  /** master timeline progress 0..1 */
  progress: number;
  /** index of the active build section (0..7), -1 before the pin */
  section: number;
  /** local progress within the active section 0..1 */
  sectionProgress: number;
  /** true while the experience is pinned & visible */
  active: boolean;
}

type Listener = (s: Readonly<HudState>, prev: Readonly<HudState>) => void;

const state: HudState = { progress: 0, section: -1, sectionProgress: 0, active: false };
const listeners = new Set<Listener>();

export const hudStore = {
  get: (): Readonly<HudState> => state,
  set(patch: Partial<HudState>): void {
    let changed = false;
    const prev = { ...state };
    for (const k of Object.keys(patch) as (keyof HudState)[]) {
      const v = patch[k];
      if (v !== undefined && state[k] !== v) {
        (state[k] as HudState[typeof k]) = v;
        changed = true;
      }
    }
    if (changed) for (const fn of listeners) fn(state, prev);
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
