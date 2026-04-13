---
title: Storage quota dashboard
trigger_condition: When the /models cache management page is complete and functional
planted_date: 2026-04-13
---

## Idea

Add a storage overview section to the /models page showing:
- Total cache space used by all models
- Browser storage quota available (via `navigator.storage.estimate()`)
- Visual progress bar of used vs available space
- Warning when approaching quota limits

This would give users a quick read on their storage situation before deciding which models to keep or remove.
