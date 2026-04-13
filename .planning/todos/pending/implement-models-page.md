---
title: Implementare pagina /models per gestione cache LLM
date: 2026-04-13
priority: high
---

## Description

Create a new `/models` page for managing locally cached LLMs. Core features:

1. **Cached models table** (expandable)
   - Parent rows: model name, total size, most recent last_used
   - Expandable child rows: quantization label, individual size, last_used
   - Delete button on both levels (single quant or all quants)

2. **Usage tracking**
   - Add `lastUsed` metadata to a persisted Zustand store (keyed by modelId + quantization)
   - Update timestamp every time a model runs in a comparison

3. **Quick cleanup**
   - Button to remove all models not used in >2 weeks
   - Confirmation dialog before bulk delete

4. **Search & download**
   - Reuse existing ModelSelector component for HuggingFace model search
   - Add "Download" action to pre-cache a model without running a comparison

5. **Cache API integration**
   - Enumerate cache entries, group by model + quantization
   - Sum Content-Length headers for size display
   - Delete specific entries by model + quantization prefix

## Reference
- Design notes: `.planning/notes/cache-management-page-design.md`
