# Phase 2: Model Selection & Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 02-model-selection-settings
**Areas discussed:** Direct model ID input, Chip info & layout, Cache & size detection, Settings page scope

---

## Direct model ID input

| Option | Description | Selected |
|--------|-------------|----------|
| Search attuale è sufficiente | Il filtro onnx+transformers.js+text-generation è già buono. Nessun direct ID, nessun accordion. MSEL-03 rimosso. | ✓ |
| Accordion Advanced | Aggiungere accordion sotto search per configurare: numero risultati, ordinamento, pipeline tag. | |
| Tieni MSEL-03 (direct ID) | Implementare il direct model ID come da spec originale. | |

**User's choice:** Search attuale è sufficiente — MSEL-03 rimosso dallo scope
**Notes:** L'utente ha osservato che se un modello non appare nell'autocomplete filtrato, non è compatibile. Il direct ID input copre un edge case raro, non giustificato per un POC.

---

## Chip info & layout

### Chip layout

| Option | Description | Selected |
|--------|-------------|----------|
| Compatto | Una riga: nome + selectors + size + cache dot + remove. | |
| Due righe | Riga 1: nome + selectors + remove. Riga 2: size + cache + backend badge. | ✓ |
| You decide | Claude sceglie. | |

**User's choice:** Due righe
**Notes:** L'utente ha specificato: icona cestino al posto della "x" per il remove button.

### Cloud model chips

| Option | Description | Selected |
|--------|-------------|----------|
| Stessa struttura due righe | Due righe anche per cloud. | |
| Chip semplificato | Una riga: nome + provider badge + cestino. | ✓ |
| You decide | Claude sceglie. | |

**User's choice:** Chip semplificato (una riga)
**Notes:** L'utente ha sollevato il tema della scelta modelli cloud — non vuole essere limitato ai modelli hardcoded.

### Cloud model selection

| Option | Description | Selected |
|--------|-------------|----------|
| Lista espansa hardcoded | 3-4 modelli per provider come quick-add buttons. | |
| Quick-add + campo custom | Bottoni rapidi + campo testo per qualsiasi model ID. | ✓ |
| Solo lista attuale | Un modello per provider come adesso. | |

**User's choice:** Quick-add + campo custom
**Notes:** L'utente ha suggerito di mettere la sezione cloud in un accordion "Cloud Models" collassabile per non ingrossare il componente. Confermato nella domanda successiva.

### ModelSelector structure confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Confermo | Search HF + chip locali + accordion Cloud + chip cloud semplificati. | ✓ |
| Modifiche | Cambiare qualcosa. | |

**User's choice:** Confermato

---

## Cache & size detection

| Option | Description | Selected |
|--------|-------------|----------|
| Size da HF API, cache on-demand | Size da siblings API, cache check via Cache API al momento della creazione chip. | ✓ |
| Size statica + no cache check | Stima approssimativa da lookup table, nessun cache check. | |
| You decide | Claude sceglie. | |

**User's choice:** Size da HF API, cache on-demand
**Notes:** Nessuna nota aggiuntiva.

---

## Settings page scope

| Option | Description | Selected |
|--------|-------------|----------|
| Completa così | API key input, show/hide, test connection coprono tutti i requisiti. | ✓ |
| Aggiungere feedback migliore | Migliorare test connection con più dettagli. | |
| You decide | Claude valuta. | |

**User's choice:** Completa così com'è
**Notes:** Nessuna modifica necessaria.

---

## Claude's Discretion

- Exact cloud models in expanded quick-add list
- Accordion visual styling
- Cloud chip placement (inside/outside accordion)
- `formatSize()` utility details
- Cache API key format for transformers.js

## Deferred Ideas

None — discussion stayed within phase scope
