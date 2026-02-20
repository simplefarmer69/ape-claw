---
name: adding-asset-sheets
description: Add new sprite sheets to the isometric city renderer, including building types, sprite pack config, rendering hooks, UI tools, and simulation sizes. Use when adding asset sheets, sprite packs, or new buildings to the isometric city game.
---

# Adding Asset Sheets

## Quick Start

Follow this workflow when introducing a new sprite sheet (with or without construction variants):

1. Place PNGs in `/public/assets/`
2. Add new `BuildingType`/`Tool` entries + `TOOL_INFO` + `BUILDING_STATS` in `src/types/game.ts`
3. Configure the sprite pack in `src/lib/renderConfig.ts`
4. Update render logic to load and select the new sheet
5. Add tools to sidebar + mobile toolbar categories
6. Map tools to buildings in `src/context/GameContext.tsx`
7. Add building sizes in `src/lib/simulation.ts`

## Reference

For the full checklist, examples, and snippets, see `reference.md`.
