export const WHITE = '#FFF';
export const BLACK = '#000';

// v3
export const TEXT_GRAY = '#47464f'
export const BG_GRAY = '#f6f2f7'
export const LIGHT_GRAY = '#e5e1e6'
export const VERY_LIGHT_GRAY = '#5e5c71'
export const RECOMMEND_COLOR = 'rgb(172,212,182)'
export const AVAILABLE_COLOR = 'rgb(250,224,148)'
export const UNRANKED_COLOR = 'rgb(235, 162, 150)'
// Neutral gray for candidates that haven't been ranked yet (rerank pending).
// Distinct from UNRANKED_COLOR (which is misnamed historically — it's the
// pink used for the low-ranked / not-recommended bucket).
export const PENDING_RERANK_COLOR = 'rgb(189, 189, 189)'
export const PRIMARY_COLORS = {
  main: '#4836ff',
  light: '#4836ff',
  dark: '#c3c0ff',
  contrastText: WHITE,
  '99': '#fffbff',
  '95': '#f2efff',
  '90': '#e2dfff',
  '80': '#c3c0ff',
  '70': '#a4a1ff',
  '60': '#8582ff',
  '50': '#6760ff',
  '40': '#4836ff',
  '30': '#2d00e5',
  '20': '#1d00a5',
  '10': '#0f0069'
}

export const SECONDARY_COLORS = {
  main: '#5e5c71',
  light: '#5e5c71',
  dark: '#c7c4dd',
  contrastText: WHITE,
  '99': '#fffbff',
  '95': '#f2efff',
  '90': '#e3e0f9',
  '80': '#c7c4dd',
  '70': '#aba9c1',
  '60': '#908ea5',
  '50': '#76758b',
  '40': VERY_LIGHT_GRAY,
  '30': '#464559',
  '20': '#2f2e42',
  '10': '#1a1a2c'
}

export const TERTIARY_COLORS = {
  main: '#7a5368',
  light: '#7a5368',
  dark: '#eab9d1',
  contrastText: WHITE,
  '99': '#fffbff',
  '95': '#ffecf3',
  '90': '#ffd8ea',
  '80': '#eab9d1',
  '70': '#cd9eb6',
  '60': '#b0849b',
  '50': '#956b81',
  '40': '#7a5368',
  '30': '#603c50',
  '20': '#472639',
  '10': '#2f1123'
}

export const SURFACE_COLORS = {
  main: '#fcf8fd',
  light: '#787680',
  dark: '#1c1b1f',
  contrastText: TEXT_GRAY,
  n90: LIGHT_GRAY,
  n92: '#ebe7ec',
  n96: BG_GRAY,
  nv80: '#c8c5d0',
  s90: '#e3e0f9'
}

export const ERROR_COLORS = {
  main: '#ba1a1a',
  light: '#ba1a1a',
  dark: '#ffb4ab',
  contrastText: WHITE,
  '95': '#ffedea'
}

export const COLORS = {
  primary: {...PRIMARY_COLORS},
  secondary: {...SECONDARY_COLORS},
  tertiary: {...TERTIARY_COLORS},
  surface: {...SURFACE_COLORS},
  error: {...ERROR_COLORS}
}
