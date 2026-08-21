/**
 * main.ts — bootstrap. Progressive enhancement in three layers:
 *  1. Crawlable HTML (always) — stats synced from projectData into data-stat spans.
 *  2. Motion layer — Lenis smooth scroll + section reveals (unless reduced motion).
 *  3. WebGL layer — lazy-loaded SceneDirector (unless reduced motion / no WebGL2),
 *     with an explicit "Play 3D experience" opt-in on the fallback.
 */
import './style.css';
import { stats, sections, otherProjects } from './data/projectData';

// the build is a narrative — always begin at the hero, never mid-pin
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------- 1 · crawlable layer ----------

function syncStatsToDom(): void {
  const byId = new Map<string, string>();
  for (const st of Object.values(stats)) byId.set(st.id, st.format(st.value));
  document.querySelectorAll<HTMLElement>('[data-stat]').forEach((el) => {
    const v = byId.get(el.dataset.stat ?? '');
    if (v) el.textContent = v;
  });
}

function buildFallbackGallery(): void {
  const ol = document.getElementById('fallback-phases');
  if (!ol) return;
  ol.innerHTML = sections
    .map((s, i) => {
      const st = stats[s.statKeys[0]];
      return `<li class="fb-phase">
        <span class="fb-no">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${s.title}</h3><p>${s.copy}</p></div>
        <div class="fb-stat"><b>${st.format(st.value)}</b><span>${st.unit}${st.verify ? ' ⟨verify⟩' : ''}</span></div>
      </li>`;
    })
    .join('');
}

function buildProjectCards(): void {
  const box = document.getElementById('project-cards');
  if (!box) return;
  box.innerHTML = otherProjects
    .map(
      (p) => `<article class="pcard">
        <span class="pcard-sector">${p.sector}${p.verify ? ' · ⟨verify⟩' : ''}</span>
        <h3>${p.name}</h3>
        <p>${p.blurb}</p>
      </article>`
    )
    .join('');
}

function wireForm(): void {
  const form = document.getElementById('enquiry') as HTMLFormElement | null;
  const note = document.getElementById('form-note');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (note) note.textContent = 'Received — wire this form to your CRM endpoint before launch.';
    form.reset();
  });
}

syncStatsToDom();
buildFallbackGallery();
buildProjectCards();
wireForm();

// ---------- 2 & 3 · motion + WebGL layers ----------

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl2 = ((): boolean => {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
})();

let booted = false;

async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  document.body.classList.remove('reduced', 'no-webgl');

  const [{ default: Lenis }, gsapMod, stMod, { SceneDirector }, { Hud }, { Loader }] =
    await Promise.all([
      import('lenis'),
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('./core/SceneDirector'),
      import('./ui/Hud'),
      import('./ui/Loader'),
    ]);
  const gsap = gsapMod.default;
  const ScrollTrigger = stMod.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  const loader = new Loader();

  // Lenis ↔ GSAP: lenis animates native scroll; ScrollTrigger listens
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const container = document.getElementById('webgl')!;
  const director = new SceneDirector(container, lenis, () => loader.finish());
  new Hud((i) => director.jumpToSection(i));

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__nav = { director, lenis };
  }

  document.getElementById('skip-build')?.addEventListener('click', () => director.skipToEnd());

  // content-section reveals — direct wrap children, then a stagger inside grids
  gsap.utils.toArray<HTMLElement>('.content-sec .wrap > *').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 42 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      }
    );
  });
  for (const grid of ['#project-cards', '.awards-grid', '.cap-list', '.fact-strip']) {
    const items = gsap.utils.toArray<HTMLElement>(`${grid} > *`);
    if (items.length === 0) continue;
    gsap.fromTo(
      items,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: grid, start: 'top 85%' },
      }
    );
  }

  // header nav anchors through lenis
  document.querySelectorAll<HTMLAnchorElement>('#site-header nav a, .brand').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href?.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) lenis.scrollTo(target as HTMLElement, { duration: 1.4 });
      }
    });
  });

  // keyboard: PageDown/arrows work natively; Home/End convenience
  addEventListener('keydown', (e) => {
    if (e.key === 'End') director.skipToEnd();
  });
}

if (!webgl2) {
  document.body.classList.add('no-webgl');
  document.getElementById('loader')?.remove();
  const note = document.getElementById('fallback-note');
  if (note) note.innerHTML = 'This device doesn’t support WebGL2 — here is the build, phase by phase.';
} else if (reducedMotion) {
  document.body.classList.add('reduced');
  document.getElementById('loader')?.remove();
  document.getElementById('play-3d')?.addEventListener('click', () => void boot());
} else {
  void boot();
}
