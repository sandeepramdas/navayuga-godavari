/**
 * projectData.ts — SINGLE SOURCE OF TRUTH for every project statistic and copy block.
 *
 * ⚠️  EVERY figure marked `verify: true` is a widely-reported public figure that MUST be
 * confirmed against primary sources before launch, in this priority order:
 *   (a) Polavaram Project Authority / AP Water Resources Department official docs
 *   (b) PIB / Ministry of Jal Shakti releases
 *   (c) Navayuga Engineering's own project pages
 *   (d) Reputable press (The Hindu, Economic Times)
 *
 * Correcting a number here propagates to the 3D HUD, the crawlable HTML copy
 * (via `syncStatsToDom()` in main.ts) and the fallback gallery. One-line edits only.
 */

export interface Stat {
  /** dot-path id used by `data-stat` attributes in index.html */
  id: string;
  label: string;
  /** numeric value used by HUD count-ups */
  value: number;
  /** printf-lite suffix/prefix formatting */
  format: (n: number) => string;
  unit: string;
  verify: boolean;
  footnote?: string;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-IN');

export const stats = {
  dischargeLakhCusecs: {
    id: 'discharge',
    label: 'Design flood discharge',
    value: 50,
    format: fmtInt,
    unit: 'lakh cusecs',
    verify: true,
    footnote: 'Reported as second only to Three Gorges by spillway discharge capacity',
  },
  gateCount: {
    id: 'gates.count',
    label: 'Radial crest gates',
    value: 48,
    format: fmtInt,
    unit: 'gates',
    verify: true,
  },
  gateWidthM: {
    id: 'gates.width',
    label: 'Gate span',
    value: 16,
    format: fmtInt,
    unit: 'm wide',
    verify: true,
  },
  gateHeightM: {
    id: 'gates.height',
    label: 'Gate height',
    value: 20,
    format: fmtInt,
    unit: 'm tall',
    verify: true,
  },
  diaphragmWallKm: {
    id: 'dwall.length',
    label: 'Diaphragm wall',
    value: 1.5,
    format: fmt1,
    unit: 'km long',
    verify: true,
    footnote: 'Among the deepest riverbed seepage barriers of its kind; rebuilt after the 2019–20 floods',
  },
  cofferdamLengthM: {
    id: 'cofferdam.length',
    label: 'Upper cofferdam',
    value: 2400,
    format: fmtInt,
    unit: 'm long',
    verify: true,
  },
  ecrfHeightM: {
    id: 'ecrf.height',
    label: 'ECRF dam height',
    value: 48,
    format: fmtInt,
    unit: 'm high',
    verify: true,
  },
  powerMW: {
    id: 'power.mw',
    label: 'Installed capacity',
    value: 960,
    format: fmtInt,
    unit: 'MW',
    verify: true,
    footnote: '12 × ~80 MW units',
  },
  storageTMC: {
    id: 'storage.tmc',
    label: 'Gross storage',
    value: 194,
    format: fmtInt,
    unit: 'TMC',
    verify: true,
  },
  frlM: {
    id: 'frl',
    label: 'Full reservoir level',
    value: 45.72,
    format: (n) => n.toFixed(2),
    unit: 'm FRL',
    verify: true,
  },
  spillwayConcreteLakhM3: {
    id: 'concrete',
    label: 'Spillway concrete',
    value: 32,
    format: fmtInt,
    unit: 'lakh m³ class',
    verify: true,
    footnote: 'Poured at reported record rates — confirm exact figure with CBIP / PPA records',
  },
} satisfies Record<string, Stat>;

export type StatKey = keyof typeof stats;

export const project = {
  name: 'Polavaram Multipurpose Irrigation Project',
  river: 'Godavari River',
  state: 'Andhra Pradesh',
  status: 'National Project',
  divertedMilestone: 'June 2021 — Godavari diverted through the completed spillway', // ⟨VERIFY⟩
  scopeLine:
    'Navayuga Engineering is head-works contractor for the Polavaram Multipurpose Irrigation Project — spillway, spill channel and earth-cum-rock-fill dam works on the Godavari.', // ⟨VERIFY scope wording⟩
};

export const company = {
  name: 'Navayuga Engineering Company Ltd',
  short: 'Navayuga',
  group: 'Navayuga Group',
  hq: 'Hyderabad, India', // ⟨VERIFY exact registered address⟩
  founder: 'C. Visweswara Rao', // ⟨VERIFY⟩
  verticals: [
    'Irrigation & Dams',
    'Ports & Marine',
    'Bridges',
    'Roads & Highways',
    'Tunnels',
    'Urban Infrastructure',
  ],
};

/** Scroll-section metadata: id, milestone chip label, HUD stat bindings, on-screen copy. */
export interface SectionDef {
  key: string;
  chip: string;
  title: string;
  copy: string;
  statKeys: StatKey[];
  /** normalized [start, end] on the master timeline */
  range: [number, number];
}

export const sections: SectionDef[] = [
  {
    key: 's1',
    chip: 'The River',
    title: 'The Godavari',
    copy: 'India’s second-longest river meets its most ambitious head-works. Polavaram — a National Project in Andhra Pradesh.',
    statKeys: ['storageTMC', 'frlM'],
    range: [0.0, 0.1],
  },
  {
    key: 's2',
    chip: 'Foundation',
    title: 'Diaphragm Wall',
    copy: 'A seepage barrier roughly 1.5 km long was cut deep into the Godavari’s bed — among the deepest of its kind ever built. Damaged in the 2019–20 floods, then rebuilt.',
    statKeys: ['diaphragmWallKm'],
    range: [0.1, 0.22],
  },
  {
    key: 's3',
    chip: 'Cofferdams',
    title: 'Dewatering the River',
    copy: 'Upper and lower cofferdams sealed off the riverbed so the spillway could be raised in the dry.',
    statKeys: ['cofferdamLengthM'],
    range: [0.22, 0.34],
  },
  {
    key: 's4',
    chip: 'Piers',
    title: 'Spillway Rises',
    copy: 'Massive concrete piers climb from the riverbed — poured at record rates, lift after lift.',
    statKeys: ['spillwayConcreteLakhM3'],
    range: [0.34, 0.5],
  },
  {
    key: 's5',
    chip: 'Gates',
    title: 'The Radial Gates',
    copy: '48 radial gates, each about 16 m wide and 20 m tall, are swung into their bays to command the flood.',
    statKeys: ['gateCount', 'gateWidthM'],
    range: [0.5, 0.62],
  },
  {
    key: 's6',
    chip: 'ECRF Dam',
    title: 'Closing the Gap',
    copy: 'An earth-cum-rock-fill dam nearly 48 m high closes the main river gap — rockfill shells around an impervious clay core.',
    statKeys: ['ecrfHeightM'],
    range: [0.62, 0.74],
  },
  {
    key: 's7',
    chip: 'Powerhouse',
    title: 'Power on the Godavari',
    copy: 'A ~960 MW powerhouse will turn the reservoir’s head into clean hydropower for the region.',
    statKeys: ['powerMW'],
    range: [0.74, 0.84],
  },
  {
    key: 's8',
    chip: '2021 · Diverted',
    title: 'The River Answers',
    copy: 'Designed to pass ~50 lakh cusecs — a discharge capacity second only to Three Gorges. In June 2021, the Godavari was diverted through the completed spillway.',
    statKeys: ['dischargeLakhCusecs'],
    range: [0.84, 1.0],
  },
];

export interface OtherProject {
  name: string;
  sector: string;
  blurb: string;
  verify?: boolean;
}

export const otherProjects: OtherProject[] = [
  {
    name: 'Krishnapatnam Port',
    sector: 'Ports & Marine',
    blurb: 'A deep-water, all-weather port on the Nellore coast — breakwaters, deep-draft berths and capital dredging built by the group.',
    verify: true,
  },
  {
    name: 'Godavari River Bridges',
    sector: 'Bridges',
    blurb: 'Long-span river crossings over the Godavari and other major rivers — heavy well foundations and segmental superstructures.',
    verify: true,
  },
  {
    name: 'National Highway Packages',
    sector: 'Roads & Highways',
    blurb: 'Multiple NHAI packages delivered EPC — expressway-grade earthworks, structures and pavements across India.',
    verify: true,
  },
  {
    name: 'Hydro & Transport Tunnels',
    sector: 'Tunnels',
    blurb: 'Drill-and-blast and TBM tunnelling for hydropower and transport in the Himalayan north.',
    verify: true,
  },
  {
    name: 'Lift Irrigation & Canals',
    sector: 'Irrigation',
    blurb: 'Lift-irrigation schemes, pump houses and canal networks watering Andhra Pradesh and Telangana.',
    verify: true,
  },
  {
    name: 'Urban Infrastructure',
    sector: 'Urban',
    blurb: 'City-scale civil works — from municipal infrastructure to marquee public buildings.',
    verify: true,
  },
];
