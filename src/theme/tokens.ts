/**
 * Shelfly brand, taken from the web app: forest green (#1E3D32) sidebar and mark,
 * paper (#F3EFE4) shelves, copper (#E08A45) uprights and primary actions,
 * Fraunces for headings and Outfit for everything else.
 */
export const fontNames = {
  display: 'Fraunces_600SemiBold',
  body: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
} as const;

export const brand = {
  forest: '#1E3D32',
  forestDeep: '#162E26',
  paper: '#F3EFE4',
  copper: '#E08A45',
} as const;

export const lightColors = {
  bg: '#F4F0E6',
  surface: '#FFFDF8',
  surface2: '#ECE6D8',
  ink: '#2A2119',
  muted: '#6A5D51',
  faint: '#8C7F70',
  line: '#E1D9C9',
  primary: '#9C4A1C',
  primaryFill: '#B5582A',
  onPrimary: '#FFFDF8',
  primarySoft: '#F6E5D8',
  forest: brand.forest,
  onForest: brand.paper,
  forestSoft: '#E2ECE6',
  good: '#22603F',
  goodSoft: '#E1F0E7',
  danger: '#A0352A',
  dangerSoft: '#F8E3DE',
  warn: '#7D5A12',
  warnSoft: '#F6EBD0',
  shadow: 'rgba(42, 33, 25, 0.08)',
};

export const darkColors: typeof lightColors = {
  bg: '#0F1512',
  surface: '#17201B',
  surface2: '#223029',
  ink: '#F2EEE5',
  muted: '#C3BAAD',
  faint: '#9A9184',
  line: '#2D3A33',
  primary: '#F0A36A',
  primaryFill: '#D9773E',
  onPrimary: '#1A120C',
  primarySoft: '#3A2619',
  forest: '#1E3D32',
  onForest: brand.paper,
  forestSoft: '#1C3329',
  good: '#93D3B0',
  goodSoft: '#173024',
  danger: '#F0B2A8',
  dangerSoft: '#3A221E',
  warn: '#E6C98A',
  warnSoft: '#332916',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

export type Palette = typeof lightColors;
export type ThemePreference = 'system' | 'light' | 'dark';
export type Tone = 'neutral' | 'good' | 'warn' | 'danger' | 'primary' | 'forest';

export function toneColors(colors: Palette, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'good':
      return { bg: colors.goodSoft, fg: colors.good };
    case 'warn':
      return { bg: colors.warnSoft, fg: colors.warn };
    case 'danger':
      return { bg: colors.dangerSoft, fg: colors.danger };
    case 'primary':
      return { bg: colors.primarySoft, fg: colors.primary };
    case 'forest':
      return { bg: colors.forestSoft, fg: colors.ink };
    default:
      return { bg: colors.surface2, fg: colors.muted };
  }
}
