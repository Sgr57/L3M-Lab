import type { TestConfig } from '../types'

/** 10-color palette for per-model identity across charts and tables */
export const MODEL_COLORS: string[] = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#0891b2',
  '#e11d48',
  '#4f46e5',
  '#ca8a04',
  '#059669',
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
