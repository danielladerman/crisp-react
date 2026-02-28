// Design tokens mirroring the web app's CSS variables
export const colors = {
  paper: '#F8F7F4',
  paperDim: '#F2F1ED',
  paperDeep: '#E8E6E1',
  ink: '#1A1A1A',
  inkMuted: '#6B6B6B',
  inkGhost: '#A3A3A3',
  sky: '#4A90D9',
  gold: '#C8A951',
  recording: '#D94A4A',
} as const

export const fonts = {
  ui: 'System',       // will swap for custom fonts later
  prompt: 'System',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const
