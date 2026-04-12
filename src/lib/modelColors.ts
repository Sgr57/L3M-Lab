import type { TestConfig } from '../types'

/** 10-color palette matching ModelSelector CONFIG_COLORS for chip/chart consistency */
export const MODEL_COLORS: string[] = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
]

/** Return the palette color for a config by its position in the configs array */
export function getModelColor(configs: TestConfig[], configId: string): string {
  const index = configs.findIndex((c) => c.id === configId)
  if (index === -1) return MODEL_COLORS[0]
  return MODEL_COLORS[index % MODEL_COLORS.length]
}

/** Convert a hex color string to rgba() with the given alpha */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
