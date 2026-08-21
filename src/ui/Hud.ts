/**
 * Hud.ts — DOM overlay synced to the 3D build via hudStore:
 * phase title/copy swaps, count-up stat cards (tabular numerals, per-digit
 * settle), milestone chips (click-to-jump), hazard-stripe construction bar.
 */
import { hudStore } from '../core/store';
import { sections, stats, type StatKey } from '../data/projectData';

interface StatCardEl {
  root: HTMLElement;
  value: HTMLElement;
  key: StatKey;
  target: number;
  shown: number;
}

export class Hud {
  private phaseIndex = document.getElementById('phase-index')!;
  private phaseTitle = document.getElementById('phase-title')!;
  private phaseCopy = document.getElementById('phase-copy')!;
  private statsBox = document.getElementById('hud-stats')!;
  private chipsBox = document.getElementById('hud-chips')!;
  private bpFill = document.getElementById('bp-fill')!;
  private bpNum = document.getElementById('bp-num')!;
  private phaseBox = document.getElementById('hud-phase')!;

  private chips: HTMLButtonElement[] = [];
  private cards: StatCardEl[] = [];
  private currentSection = -2;
  private raf = 0;

  constructor(onChip: (i: number) => void) {
    // milestone chips
    for (let i = 0; i < sections.length; i++) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = sections[i].chip;
      b.addEventListener('click', () => onChip(i));
      this.chipsBox.appendChild(b);
      this.chips.push(b);
    }

    hudStore.subscribe((s, prev) => {
      if (s.section !== prev.section) this.setSection(s.section);
      if (s.progress !== prev.progress) {
        const pct = Math.round(s.progress * 100);
        this.bpFill.style.width = `${pct}%`;
        this.bpNum.textContent = String(pct);
      }
      if (s.sectionProgress !== prev.sectionProgress) this.driveCounters(s.sectionProgress);
    });
  }

  private setSection(i: number): void {
    if (i === this.currentSection) return;
    this.currentSection = i;

    for (let c = 0; c < this.chips.length; c++) {
      this.chips[c].classList.toggle('active', c === i);
      this.chips[c].classList.toggle('done', c < i);
    }

    if (i < 0) {
      this.phaseBox.style.opacity = '0';
      this.clearCards();
      return;
    }
    const def = sections[i];
    this.phaseBox.style.opacity = '1';
    this.phaseIndex.textContent = `${String(i + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`;
    this.phaseTitle.textContent = def.title;
    this.phaseCopy.textContent = def.copy;
    // re-trigger entrance
    this.phaseBox.animate(
      [
        { opacity: 0, transform: 'translateY(18px)', filter: 'blur(4px)' },
        { opacity: 1, transform: 'none', filter: 'none' },
      ],
      { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );

    this.clearCards();
    for (const key of def.statKeys) this.addCard(key);
  }

  private addCard(key: StatKey): void {
    const st = stats[key];
    const root = document.createElement('div');
    root.className = 'stat-card';
    root.innerHTML =
      `<div class="stat-value"><span class="sv">0</span><span class="stat-unit">${st.unit}</span></div>` +
      `<div class="stat-label">${st.label}${st.verify ? '<span class="stat-verify">⟨verify⟩</span>' : ''}</div>`;
    this.statsBox.appendChild(root);
    requestAnimationFrame(() => root.classList.add('in'));
    this.cards.push({
      root,
      value: root.querySelector('.sv') as HTMLElement,
      key,
      target: st.value,
      shown: -1,
    });
  }

  private clearCards(): void {
    for (const c of this.cards) {
      c.root.classList.add('out');
      const el = c.root;
      setTimeout(() => el.remove(), 350);
    }
    this.cards.length = 0;
  }

  /** count-ups scrub with section progress (0→ settled by 55%) */
  private driveCounters(p: number): void {
    if (this.cards.length === 0) return;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const k = Math.min(1, p / 0.55);
      const eased = 1 - Math.pow(1 - k, 3);
      for (const c of this.cards) {
        const v = c.target * eased;
        if (v !== c.shown) {
          c.shown = v;
          c.value.textContent = stats[c.key].format(v);
        }
      }
    });
  }
}
