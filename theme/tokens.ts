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
};

export const typography = {
  heroNumber: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 96 },
  screenTitle: { fontFamily: 'Inter-Bold', fontWeight: '700' as const, fontSize: 28 },
  sectionHead: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 20 },
  body: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 17 },
  secondary: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 15 },
  statMono: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  eyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
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
