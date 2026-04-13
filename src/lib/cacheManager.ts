import { ModelRegistry } from '@huggingface/transformers'
import type { CacheEntry, CachedModelInfo, CachedQuantInfo } from '../types'

const CACHE_NAME = 'transformers-cache'
const HF_URL_PATTERN = /^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/

/**
 * Enumerate all entries in the transformers-cache bucket.
 * Parses HuggingFace CDN URLs to extract modelId and filepath.
 * Uses Promise.all for parallel processing (per RESEARCH.md Pitfall 2).
 */
export async function enumerateCache(): Promise<CacheEntry[]> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const requests = await cache.keys()

    const entries = await Promise.all(
      requests.map(async (req): Promise<CacheEntry | null> => {
        const match = req.url.match(HF_URL_PATTERN)
        if (!match) return null

        const [, modelId, filepath] = match
        const response = await cache.match(req)
        if (!response) return null

        // Prefer Content-Length header; fall back to blob size (Pitfall 1)
        const cl = response.headers.get('Content-Length')
        const parsed = cl ? parseInt(cl, 10) : NaN
        const size = !isNaN(parsed) ? parsed : (await response.clone().blob()).size

        return { modelId, filepath, url: req.url, size }
      })
    )

    return entries.filter((e): e is CacheEntry => e !== null)
  } catch {
    return []
  }
}

/**
 * Match a filepath to its quantization type.
 * Reuses same logic as hfSearch.ts matchQuantization for consistency.
 * Returns null for non-ONNX files (config.json, tokenizer.json, etc.).
 */
export function quantizationFromFilepath(filepath: string): string | null {
  const name = filepath.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'model.onnx') return 'fp32'
  if (name.includes('fp16') || name.includes('float16')) return 'fp16'
  if (name.includes('q4') || name.includes('int4') || name.includes('bnb4')) return 'q4'
  if (name.includes('q8') || name.includes('int8') || name.includes('uint8') || name === 'model_quantized.onnx') return 'q8'
  return null
}

/**
 * Group cache entries into a hierarchical structure by model and quantization.
 * Files with null quantization (config.json, tokenizer.json) are counted in
 * the model's total size but not assigned to any quantization group.
 */
export function groupByModelAndQuant(
  entries: CacheEntry[],
  usageStore: { getLastUsed: (modelId: string, quantization: string) => number | null }
): CachedModelInfo[] {
  // Group entries by modelId
  const byModel = new Map<string, CacheEntry[]>()
  for (const entry of entries) {
    const group = byModel.get(entry.modelId) ?? []
    group.push(entry)
    byModel.set(entry.modelId, group)
  }

  const result: CachedModelInfo[] = []

  for (const [modelId, modelEntries] of byModel) {
    // Sub-group by quantization
    const byQuant = new Map<string, { size: number; files: string[] }>()
    let sharedSize = 0

    for (const entry of modelEntries) {
      const quant = quantizationFromFilepath(entry.filepath)
      if (quant === null) {
        // Shared files (config.json, tokenizer.json, etc.) — count in total only
        sharedSize += entry.size
        continue
      }

      const group = byQuant.get(quant) ?? { size: 0, files: [] }
      group.size += entry.size
      group.files.push(entry.filepath)
      byQuant.set(quant, group)
    }

    // Build quantization info array with usage data
    const quantizations: CachedQuantInfo[] = []
    let modelLastUsed: number | null = null

    for (const [quant, data] of byQuant) {
      const lastUsed = usageStore.getLastUsed(modelId, quant)
      quantizations.push({
        quantization: quant,
        size: data.size,
        lastUsed,
        files: data.files,
      })

      // Model-level lastUsed is the max across all quantizations
      if (lastUsed !== null) {
        modelLastUsed = modelLastUsed === null ? lastUsed : Math.max(modelLastUsed, lastUsed)
      }
    }

    // Total size includes all quantizations plus shared files
    const totalSize = quantizations.reduce((sum, q) => sum + q.size, 0) + sharedSize

    result.push({
      modelId,
      totalSize,
      lastUsed: modelLastUsed,
      quantizations,
    })
  }

  // Sort by modelId ascending
  result.sort((a, b) => a.modelId.localeCompare(b.modelId))

  return result
}

/**
 * Delete cached files for a model, optionally limited to a specific dtype.
 * Uses ModelRegistry.clear_cache as primary method with raw Cache API fallback.
 */
export async function deleteCachedModel(
  modelId: string,
  dtype?: string
): Promise<{ filesDeleted: number; filesCached: number }> {
  try {
    // ModelRegistry.clear_cache expects dtype as DataType (string literal union)
    // Cast to any to satisfy the type since our dtype strings match the expected values
    if (dtype) {
      // Delete specific quantization, preserve shared files (tokenizer, config)
      const result = await ModelRegistry.clear_cache(modelId, {
        dtype: dtype as 'fp32',  // cast to satisfy DataType union
        include_tokenizer: false,
        include_processor: false,
      })
      return { filesDeleted: result.filesDeleted, filesCached: result.filesCached }
    } else {
      // Delete all (includes shared files)
      const result = await ModelRegistry.clear_cache(modelId)
      return { filesDeleted: result.filesDeleted, filesCached: result.filesCached }
    }
  } catch {
    // Fallback: raw Cache API deletion (Pitfall 6)
    return await rawCacheDelete(modelId, dtype)
  }
}

/**
 * Raw Cache API fallback for deletion when ModelRegistry fails.
 */
async function rawCacheDelete(
  modelId: string,
  dtype?: string
): Promise<{ filesDeleted: number; filesCached: number }> {
  const cache = await caches.open(CACHE_NAME)
  const requests = await cache.keys()
  let deleted = 0
  let found = 0

  for (const req of requests) {
    // Match URLs containing the modelId (handles both encoded and plain slashes)
    if (!req.url.includes(modelId.replace('/', '%2F')) && !req.url.includes(modelId)) {
      continue
    }

    if (dtype) {
      // Only delete entries matching this quantization
      const filepath = req.url.split('/resolve/main/').pop() ?? ''
      const fileQuant = quantizationFromFilepath(filepath)
      // Skip files that have a known quant but don't match the target dtype
      if (fileQuant && fileQuant !== dtype) continue
      // Also skip shared files (null quant) when deleting a specific dtype
      if (fileQuant === null) continue
    }

    found++
    if (await cache.delete(req)) deleted++
  }

  return { filesDeleted: deleted, filesCached: found }
}

/**
 * Identify stale cached models/quantizations based on lastUsed timestamp.
 * Includes entries with null lastUsed (never used = stale).
 */
export function getStaleModelKeys(
  models: CachedModelInfo[],
  maxAgeMs: number
): { modelId: string; quantization: string }[] {
  const now = Date.now()
  const stale: { modelId: string; quantization: string }[] = []

  for (const model of models) {
    for (const quant of model.quantizations) {
      if (quant.lastUsed === null || now - quant.lastUsed > maxAgeMs) {
        stale.push({ modelId: model.modelId, quantization: quant.quantization })
      }
    }
  }

  return stale
}
