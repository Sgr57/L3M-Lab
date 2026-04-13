---
title: Cache management page design
date: 2026-04-13
context: Exploration session — designing the /models page for LLM cache management
---

## Decisions

### Layout: Expandable table
- Row per model (name, total size, most recent last_used across quantizations, delete-all button)
- Expandable sub-rows per quantization (quantization label, size, last_used, delete button)
- Compact, file-manager style

### Data model
- Unit of management: **model + quantization** (same model with different quants = separate cached items)
- Sizes: calculated by enumerating Cache API entries, grouping by model ID + quantization, summing Content-Length headers
- Last used: tracked in a Zustand persisted store, updated every time a model is used in a comparison test

### Features
- **List cached models** with size and last usage
- **Delete** individual quantizations or all quantizations of a model
- **Quick cleanup** button: remove all models unused for >2 weeks
- **Search & download new models**: reuse existing ModelSelector component (HuggingFace search)
- **Filters/sort** on the cached models table

### Page route
- `/models` — new page alongside `/` (compare) and `/settings`

### Architecture notes
- Cache API bucket: "default" — entries grouped by model path prefix
- Content-Length header available on all cache entries for size calculation
- No backend needed — all data from Cache API + persisted Zustand store
