/**
 * Loader.ts — blueprint self-draw + % readout. The scene is fully procedural,
 * so "loading" = fonts + shader compilation; the readout eases to 92% on a
 * clock and snaps to 100 when the director reports ready.
 */
export class Loader {
  private el = document.getElementById('loader')!;
  private num = document.getElementById('loader-num')!;
  private fake = 0;
  private ready = false;
  private raf = 0;
  private t0 = performance.now();

  constructor() {
    this.tick();
  }

  private tick = (): void => {
    const t = (performance.now() - this.t0) / 1400;
    this.fake = Math.min(92, Math.round((1 - Math.pow(1 - Math.min(t, 1), 2)) * 92));
    this.num.textContent = String(this.ready ? 100 : this.fake);
    if (!this.ready) this.raf = requestAnimationFrame(this.tick);
  };

  finish(): void {
    this.ready = true;
    cancelAnimationFrame(this.raf);
    this.num.textContent = '100';
    setTimeout(() => this.el.classList.add('done'), 250);
    setTimeout(() => this.el.remove(), 1100);
  }
}
