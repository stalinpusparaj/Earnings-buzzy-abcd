// Palette tokens. Everything procedural pulls its colours from here.
export const theme = {
  grass: '#7BC950',
  grassDark: '#5FA83A',
  path: '#F2D7A1',
  skyTop: '#8ED1FC',
  skyBottom: '#E0F4FF',
  soil: '#9A6B45',
  soilDark: '#6E4A2E',
  rock: '#A7A9B4',
  moss: '#8CCB5E',
  water: '#6FD3E8',
  waterLight: '#B8EEF7',
  cloud: '#FFFFFF',
  buzzyBody: '#FFD23F',
  buzzyStripe: '#3B2A20',
  cheek: '#FF8FA3',
  petals: ['#FF8FA3', '#FFB84C', '#B28DFF', '#6FD3E8', '#FF6B6B', '#9BE15D'],
  glyphFill: '#FFFFFF',
  glyphOutline: '#3B2A20',
  pollen: '#FFE066',
  trail: '#FFD23F',
  startDot: '#4CD964',
} as const;

// One font stack for every canvas-drawn glyph. "Buzzy Glyph" is the self-hosted
// Baloo 2 (Latin) + Baloo Thambi 2 (Tamil) pair from core/fonts.ts; the platform fonts
// after it only matter if those files fail to load.
export const GLYPH_FONT =
  '"Buzzy Glyph", "Baloo 2", "Arial Rounded MT Bold", "Tamil Sangam MN", "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif';
