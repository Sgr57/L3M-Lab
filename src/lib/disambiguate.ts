import type { TestConfig, Backend } from '../types'

function backendLabel(b: Backend): string {
  switch (b) {
    case 'webgpu':
      return 'WebGPU'
    case 'wasm':
      return 'WASM'
    case 'api':
      return 'API'
  }
}

/**
 * Build unique display labels for each config.
 * Appends a minimal suffix only when displayName collides:
 *   - quantization if unique within group
 *   - backend if unique within group
 *   - both if neither alone is unique
 */
export function getDisambiguatedLabels(configs: TestConfig[]): Map<string, string> {
  const labels = new Map<string, string>()

  // Group configs by displayName
  const groups = new Map<string, TestConfig[]>()
  for (const c of configs) {
    const existing = groups.get(c.displayName)
    if (existing) {
      existing.push(c)
    } else {
      groups.set(c.displayName, [c])
    }
  }

  for (const [displayName, group] of groups) {
    if (group.length === 1) {
      // No collision — use displayName as-is
      labels.set(group[0].id, displayName)
    } else {
      // Collision — determine minimal disambiguation suffix
      const uniqueQuants = new Set(group.map((c) => c.quantization))
      const uniqueBackends = new Set(group.map((c) => c.backend))

      if (uniqueQuants.size === group.length) {
        // Quantization alone disambiguates
        for (const c of group) {
          labels.set(c.id, `${displayName} (${c.quantization.toUpperCase()})`)
        }
      } else if (uniqueBackends.size === group.length) {
        // Backend alone disambiguates
        for (const c of group) {
          labels.set(c.id, `${displayName} (${backendLabel(c.backend)})`)
        }
      } else {
        // Both needed
        for (const c of group) {
          labels.set(c.id, `${displayName} (${c.quantization.toUpperCase()}/${backendLabel(c.backend)})`)
        }
      }
    }
  }

  return labels
}
