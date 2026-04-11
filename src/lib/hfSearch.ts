import type { HFModelResult, Quantization } from '../types'

const HF_API = 'https://huggingface.co/api/models'

interface HFApiModel {
  modelId: string
  id: string
  downloads: number
  likes: number
  pipeline_tag: string
  library_name: string
  tags: string[]
}

/**
 * Search HuggingFace for text-generation models with ONNX support.
 * Only returns models tagged with both "transformers.js" and "onnx".
 */
export async function searchModels(query: string): Promise<HFModelResult[]> {
  if (!query.trim()) return []

  // Use "filter" to require both "onnx" AND "transformers.js" tags.
  // This is the only reliable way to get actual ONNX-compatible models.
  const params = new URLSearchParams({
    search: query,
    filter: 'onnx,transformers.js',
    pipeline_tag: 'text-generation',
    sort: 'downloads',
    direction: '-1',
    limit: '20',
  })

  const res = await fetch(`${HF_API}?${params}`)
  if (!res.ok) return []

  const data: HFApiModel[] = await res.json()

  return data.map((model) => ({
    modelId: model.modelId ?? model.id,
    name: (model.modelId ?? model.id).split('/').pop() ?? model.id,
    downloads: model.downloads ?? 0,
    likes: model.likes ?? 0,
    pipelineTag: model.pipeline_tag ?? '',
    libraryName: model.library_name ?? '',
    availableQuantizations: [],
  }))
}

export interface ModelDetails {
  quantizations: Quantization[]
  sizeByQuant: Record<string, number>  // keyed by Quantization value, value in bytes
}

/**
 * Fetch model details including quantizations and per-quantization file sizes.
 * Uses ?blobs=true to get file sizes from the HF API siblings array.
 * Results should be cached per modelId to avoid rate limiting (T-02-03).
 */
export async function fetchModelDetails(modelId: string): Promise<ModelDetails> {
  try {
    const res = await fetch(`${HF_API}/${modelId}?blobs=true`)
    if (!res.ok) return { quantizations: ['fp32'], sizeByQuant: {} }

    const data = await res.json()
    const siblings: Array<{ rfilename: string; size: number }> = data.siblings ?? []

    const onnxFiles = siblings.filter((s) => s.rfilename.endsWith('.onnx'))

    // Extract quantizations using existing logic
    const quantizations = extractQuantizations(onnxFiles.map((s) => s.rfilename))

    // Map sizes per quantization by summing all ONNX files matching each quant
    const sizeByQuant: Record<string, number> = {}
    for (const file of onnxFiles) {
      const quant = matchQuantization(file.rfilename)
      if (quant) {
        sizeByQuant[quant] = (sizeByQuant[quant] ?? 0) + file.size
      }
    }

    return { quantizations, sizeByQuant }
  } catch {
    return { quantizations: ['fp32'], sizeByQuant: {} }
  }
}

/**
 * Match a single ONNX filepath to its quantization type.
 * Reuses the same matching logic as extractQuantizations.
 */
function matchQuantization(filepath: string): Quantization | null {
  const name = filepath.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'model.onnx') return 'fp32'
  if (name.includes('fp16') || name.includes('float16')) return 'fp16'
  if (name.includes('q4') || name.includes('int4') || name.includes('bnb4')) return 'q4'
  if (name.includes('q8') || name.includes('int8') || name.includes('uint8') || name === 'model_quantized.onnx') return 'q8'
  return null
}

/**
 * Map ONNX filenames to quantization types.
 *
 * Common patterns in HuggingFace ONNX repos:
 * - model.onnx          → fp32 (full precision)
 * - model_fp16.onnx      → fp16
 * - model_q4.onnx        → q4
 * - model_q4f16.onnx     → q4 (4-bit weights, fp16 activations — same dtype as q4)
 * - model_int8.onnx      → q8
 * - model_uint8.onnx     → q8
 * - model_quantized.onnx → q8 (default ONNX quantization is int8)
 * - model_bnb4.onnx      → q4
 */
function extractQuantizations(onnxFiles: string[]): Quantization[] {
  const quants = new Set<Quantization>()

  for (const file of onnxFiles) {
    const name = file.split('/').pop()?.toLowerCase() ?? ''

    if (name === 'model.onnx') {
      quants.add('fp32')
    }
    if (name.includes('fp16') || name.includes('float16')) {
      quants.add('fp16')
    }
    if (name.includes('q4') || name.includes('int4') || name.includes('bnb4')) {
      quants.add('q4')
    }
    if (
      name.includes('q8') ||
      name.includes('int8') ||
      name.includes('uint8') ||
      name === 'model_quantized.onnx'
    ) {
      quants.add('q8')
    }
  }

  // If no quantizations detected, assume fp32 as the base
  if (quants.size === 0) quants.add('fp32')

  // Return in a consistent order: lightest first
  const order: Quantization[] = ['q4', 'q8', 'fp16', 'fp32']
  return order.filter((q) => quants.has(q))
}
