// Escuadra — design tokens
// Plain exported objects. No styling library, no CSS-in-JS. Spacing is unitless (RN dp).

export const colors = {
  background: '#07090b',
  surface: '#111416',
  surfaceRaised: '#1c2022',
  border: '#33393d',
  textPrimary: '#f3f5f7',
  textSecondary: '#b4b8bb',
  textMuted: '#707579',
  accent: '#3e45a3',
  accentOn: '#f3f5f7', // text/icon colour to place on top of `accent`
  success: '#61bd67',
  successBg: 'rgba(97,189,103,0.14)',
  error: '#f05653',
  errorBg: 'rgba(240,86,83,0.10)',
  errorBorderDim: '#5c3230',
  // Dimmed error text for an "incorrect-picked" option — visually quieter
  // than `error` so the correct answer stays the loudest thing on screen.
  errorTextDim: '#a15a58',
} as const;

// Every team accent shares the same lightness/chroma as `colors.accent` (OKLCH
// 78% L / 0.14 C), rotated in hue. Decorative identity only — never a button,
// selection, or correct/incorrect colour. Keyed by a short id, not the full name.
export const teamAccents: Record<string, string> = {
  ars: '#ff8faa', // Arsenal
  rma: '#ff9577', // Real Madrid
  bay: '#fe9b5f', // Bayern Munich
  boc: '#f3a44a', // Boca Juniors
  aln: '#e5ad3c', // Al Nassr
  mci: '#d2b63c', // Manchester City
  juv: '#bbbf49', // Juventus
  bar: '#a1c75e', // Barcelona
  fla: '#60d291', // Flamengo
  psg: '#37d4ab', // Paris Saint-Germain
  bra: '#00d4c5', // Brazil
  ger: '#00cdf0', // Germany
  arg: '#3dc6ff', // Argentina
  jpn: '#63bfff', // Japan
  nga: '#83b7ff', // Nigeria
  por: '#9faeff', // Portugal
  ned: '#b8a6ff', // Netherlands
  mar: '#ce9ffe', // Morocco
  kor: '#e098ee', // South Korea
  esp: '#ef93d9', // Spain
  // Added for the 10-squad roster — same OKLCH 78% L / 0.14 C formula,
  // slotted into the two largest unused hue gaps in the wheel above (the
  // other large gaps sit deliberately close to accent/success/error and were
  // already skipped by the original 20).
  int: '#00d1dc', // Inter Milan
  fra: '#fa90c3', // France
};

export const typography = {
  heroNumber: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 96 },
  // Results screen's giant score readout.
  scoreHero: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 56 },
  screenTitle: { fontFamily: 'Inter-Bold', fontWeight: '700' as const, fontSize: 28 },
  sectionHead: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 20 },
  body: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 17 },
  // The "correct, unpicked" answer option after a wrong pick — same size as
  // `body`, bolder weight, so it visibly outweighs the rest without a new size.
  bodyEmphasis: { fontFamily: 'Inter-Bold', fontWeight: '800' as const, fontSize: 17 },
  secondary: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 15 },
  secondarySmall: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 13 },
  statMono: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  statMonoSmall: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 13 },
  statMonoTiny: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // Team-row names, chip labels — one step down from `body`.
  rowTitle: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  chipLabel: { fontFamily: 'Inter-Bold', fontWeight: '700' as const, fontSize: 14 },
  // Segmented-control / filter-pill labels.
  segmentLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 13 },
  filterLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // Difficulty-ladder badge number.
  badgeNumber: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 18 },
  // Difficulty-row / card descriptions — one step down from `secondary`.
  descriptionSmall: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 12.5 },
  // Study screen table cells.
  tableName: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 14 },
  tableCell: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 11 },
  tableHeader: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  eyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  // Shared by AnswerOption's "CORRECT ANSWER" caption, stat-chip labels,
  // difficulty-row status pills, and the Study screen's column headers.
  captionEyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

// 1.5px is the option-card default; 2px marks the emphasised "correct,
// unpicked" card in the incorrect-reveal state.
export const borderWidths = {
  hairline: 1,
  thick: 1.5,
  emphasis: 2,
} as const;

// Named opacity stops from the interaction-state spec — never an inline
// 0.4/0.65/etc in a component.
export const opacity = {
  disabled: 0.55, // locked difficulty row
  dimmed: 0.65, // incorrect-picked text/border
  faded: 0.4, // unrelated options during an incorrect reveal
  settled: 0.7, // other options once one is picked correct
  loadingBlank: 0.25, // option cards mid question-transition
  dotPast: 0.9, // progress dots for answered questions
  dotFuture: 0.35, // progress dots not yet reached
} as const;

// All under 300ms, per CLAUDE.md's motion rule.
export const durations = {
  press: 100,
  reveal: 180,
  pop: 100,
  popSettle: 120,
  transition: 150,
  collapse: 200,
  skeleton: 900,
} as const;

// Keyed by question-engine Level (1 | 2 | 3) — escalating hero/badge weight
// as difficulty rises, per the design's difficulty-ladder and hero-card specs.
export const heroCardSize = { 1: 220, 2: 130, 3: 108 } as const;
export const heroNumberSize = { 1: 104, 2: 64, 3: 52 } as const;
export const badgeSize = { 1: 40, 2: 48, 3: 56 } as const;
export const difficultyTitleSize = { 1: 15, 2: 17, 3: 19 } as const;
export const difficultyTitleWeight = { 1: '400', 2: '600', 3: '800' } as const;

export const sizes = {
  progressDot: 5,
  // Horizontal offset of the difficulty ladder's connector line — centred
  // under the badge column regardless of level (badges vary 40-56px wide).
  difficultyConnectorOffset: 27,
  studyColumn: { no: 26, position: 34, apps: 40 },
  // Home's "Start Training" is the one 56px control; every other button
  // (Continue, Results actions) is 52px.
  controlHeight: 52,
  controlHeightLarge: 56,
  teamDot: 10,
  rowHeight: 56,
  teamUnderline: { width: 28, height: 2 },
  missedNumberWidth: 24,
} as const;

export const iconSize = {
  markLarge: 18, // AnswerOption's correct ✓
  markSmall: 13, // AnswerOption's incorrect ✕
  chevron: 16, // TeamRow / DifficultyRow disclosure chevron
  chevronLarge: 18, // Home's continue-card chevron
} as const;

// Base unit 4. Use spacing[n], not raw numbers, in component styles.
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Single-layer shadows only — keep each usage to one shadow* set (+ elevation for Android).
export const elevation = {
  e1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  e2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export type TeamId = keyof typeof teamAccents;
