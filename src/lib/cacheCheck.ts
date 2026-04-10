import type { Quantization } from '../types'

const CACHE_NAME = 'transformers-cache'
const HF_CDN = 'https://huggingface.co'

// Maps quantization to possible ONNX filename patterns for cache lookup
const QUANT_FILENAMES: Record<Quantization, string[]> = {
  q4: ['model_q4.onnx', 'model_q4f16.onnx', 'model_bnb4.onnx', 'model_int4.onnx'],
  q8: ['model_q8.onnx', 'model_int8.onnx', 'model_uint8.onnx', 'model_quantized.onnx'],
  fp16: ['model_fp16.onnx', 'model_float16.onnx'],
  fp32: ['model.onnx'],
}

export async function isModelCached(
  modelId: string,
  quantization: Quantization
): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const filenames = QUANT_FILENAMES[quantization] ?? []

    for (const filename of filenames) {
      const url = `${HF_CDN}/${modelId}/resolve/main/onnx/${filename}`
      const match = await cache.match(url)
      if (match !== undefined) return true
    }
    return false
  } catch {
    return false  // Cache API not available or error
  }
}
