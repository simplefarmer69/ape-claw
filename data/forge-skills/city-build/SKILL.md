---
name: city-build
description: Generate isometric sprite sheet images for the city game using the GenerateImage tool with reference images. Handles buildings, vehicles, airplanes, boats, trains, nature, and infrastructure assets. Use when creating new game assets, sprite sheets, or any visual assets for the isometric city builder. Ensures consistent grid format, red background keying, isometric projections, and hyper-realistic style.
---

# Isometric Asset Sheet Generation

Generate consistent sprite sheets for the isometric city game using the GenerateImage tool with existing sheets as style references.

## Standard Format

All asset sheets follow this format:

| Property | Value |
|----------|-------|
| Size | 2048x2048 square |
| Background | Solid red (#FF0000) -- used for transparency keying |
| Grid | 6 rows x 5 columns (30 cells) |
| Style | Hyper-realistic, consistent lighting |
| Shadows | None |

The red background is critical -- the game engine filters `#FF0000` pixels to transparent at load time (color threshold: 155 Euclidean distance). Never use gradients or off-red tones.

## Grid Layout

Each row = ONE complete asset. Columns are directional views:

| Column | View |
|--------|------|
| 1 | Isometric facing **North West** |
| 2 | Isometric facing **North East** |
| 3 | Isometric facing **South East** |
| 4 | Isometric facing **South West** |
| 5 | Special view (see table below) |

### Column 5 Special Views

| Asset Type | Column 5 View |
|------------|---------------|
| Buildings | Front-facing isometric detail view |
| Airplanes | Gears down, head-first isometric (landing approach) |
| Helicopters | Top-down rotor view |
| Vehicles/Cars | 3/4 front isometric |
| Boats/Ships | Docked/stationary overhead isometric |
| Trains | Front cab view |
| Trees/Nature | Top-down canopy view |
| Infrastructure | Front elevation or cutaway |

## Generation Workflow

### Step 1: Select a Reference Image

**Always** pass an existing sprite sheet as a reference image to maintain visual consistency.

Pick the closest match from `/public/assets/`:

| For This Asset Type | Use This Reference |
|--------------------|--------------------|
| Buildings (default) | `sprites_red_water_new.png` |
| Dense/urban buildings | `sprites_red_water_new_dense.png` |
| Parks/recreation | `sprites_red_water_new_parks.png` |
| Farms/agriculture | `sprites_red_water_new_farm.png` |
| Shops/commercial | `sprites_red_water_new_shops.png` |
| Services/utilities | `sprites_red_water_new_services.png` |
| Stations/transit | `sprites_red_water_new_stations.png` |
| Airplanes | `sprites_red_water_new_planes.png` |
| Vehicles/boats/trains | `sprites_red_water_new.png` (or closest match) |

### Step 2: Generate the Sheet

Call `GenerateImage` with:
- `description`: The full prompt (see template below)
- `reference_image_paths`: Array containing the reference sheet path
- `filename`: Descriptive name matching naming convention

### Step 3: Save and Compress

1. Save to `/public/assets/` with naming convention: `sprites_red_water_new_[variant].png`
2. Run `npm run compress-images` to generate WebP versions

### Step 4: Integrate

Follow the [adding-asset-sheets guide](../../../skills/adding-asset-sheets.md) to wire the new sheet into the game. That guide covers:
- Defining building types in `game.ts`
- Configuring the sprite pack in `renderConfig.ts`
- Updating rendering logic in `Game.tsx`
- Adding UI entries and enabling placement

## Prompt Template

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with [ASSET TYPE] for my isometric city game.

Each row is ONE [ASSET]. Columns 1-4: the [ASSET] isometrically projected facing north west, north east, south east, south west. Column 5: [SPECIAL VIEW].

ALL [ASSETS] HYPER REALISTIC. [ROW DESCRIPTIONS].

NO SHADOWS. [ASSET-SPECIFIC CONSTRAINTS]. Every asset centered in its cell.
```

## Example Prompts

### Buildings

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with BUILDINGS for my isometric city game.

Each row is ONE BUILDING. Columns 1-4: the building isometrically projected facing north west, north east, south east, south west. Column 5: front-facing isometric detail view.

ALL BUILDINGS HYPER REALISTIC. Row 1-2: low-rise residential. Row 3-4: mid-rise commercial. Row 5-6: high-rise office towers.

NO SHADOWS. Consistent lighting angle across all buildings. Every building centered in its cell.
```

### Airplanes

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with AIRPLANES for my isometric city game.

Each row is ONE PLANE. Columns 1-4: the airplane isometrically projected flying north west, north east, south east, south west. Column 5: gears down head-first isometric view (landing approach).

ALL PLANES HYPER REALISTIC. Rows 1-3: commercial airliners. Rows 4-6: private jets.

NO SHADOWS. For columns 1-4, NO LANDING GEAR. No contrails. Every plane centered in its cell.
```

### Vehicles

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with VEHICLES for my isometric city game.

Each row is ONE VEHICLE. Columns 1-4: the vehicle isometrically projected facing north west, north east, south east, south west. Column 5: 3/4 front isometric view.

ALL VEHICLES HYPER REALISTIC. Row 1-2: sedans. Row 3-4: SUVs. Row 5-6: trucks.

NO SHADOWS. Wheels visible. No reflections. Every vehicle centered in its cell.
```

### Boats/Ships

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with BOATS for my isometric city game.

Each row is ONE BOAT. Columns 1-4: the boat isometrically projected facing north west, north east, south east, south west. Column 5: docked/stationary overhead isometric view.

ALL BOATS HYPER REALISTIC. Row 1-3: small boats (fishing, sailboat, speedboat). Row 4-6: larger vessels (yacht, cargo, ferry).

NO SHADOWS. NO WATER. NO WAKE EFFECTS. Every boat centered in its cell.
```

### Trains

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with TRAINS for my isometric city game.

Each row is ONE TRAIN. Columns 1-4: the train isometrically projected facing north west, north east, south east, south west. Column 5: front cab view.

ALL TRAINS HYPER REALISTIC. Row 1-2: passenger trains. Row 3-4: freight trains. Row 5-6: metro/light rail.

NO SHADOWS. No tracks. Every train centered in its cell.
```

### Nature/Trees

```
Using the same format as the reference image - red background (#FF0000), 6 rows, 5 columns, 2048x2048 square - generate a new asset sheet with TREES for my isometric city game.

Each row is ONE TREE. Columns 1-4: the tree isometrically projected facing north west, north east, south east, south west. Column 5: top-down canopy view.

ALL TREES HYPER REALISTIC. Row 1-2: deciduous (oak, maple). Row 3-4: coniferous (pine, spruce). Row 5-6: tropical (palm, banyan).

NO SHADOWS. No ground/grass beneath. Every tree centered in its cell.
```

## Asset-Specific Constraints

| Asset Type | Constraints |
|------------|-------------|
| Airplanes | No landing gear (flying views), no contrails |
| Helicopters | Rotors visible, no motion blur |
| Vehicles | Wheels visible, no reflections |
| Boats | No water, no wake effects |
| Trains | No tracks, no platform |
| Buildings | Consistent lighting angle, no ground plane |
| Nature | No ground/grass, no soil visible |
| Infrastructure | No surrounding terrain |

## Row Organization

Organize rows by size or category:

- **Buildings**: Low-rise (rows 1-2), mid-rise (3-4), high-rise (5-6)
- **Vehicles**: Small (sedans) to large (trucks)
- **Airplanes**: Commercial (1-3), private (4-6)
- **Nature**: By species or season grouping
- **Infrastructure**: By utility type

## Naming Convention

```
sprites_red_water_new_[variant].png
```

Examples:
- `sprites_red_water_new_trains.png`
- `sprites_red_water_new_boats.png`
- `sprites_red_water_new_nature.png`
- `sprites_red_water_new_shops_construction.png` (construction variant)
- `sprites_red_water_new_shops_abandoned.png` (abandoned variant)

Variant sheets (construction, abandoned) must share the same grid layout as the main sheet.

## Common Issues

| Problem | Solution |
|---------|----------|
| Inconsistent sizing | Add "same size for all assets" and "centered in each cell" |
| Shadows appearing | Explicitly state "NO SHADOWS" in caps |
| Wrong projections | Reference compass directions (NW, NE, SE, SW) |
| Cut-off assets | Add "centered in each cell, no cropping" |
| Background not pure red | Specify "#FF0000" hex code explicitly |
| Inconsistent style | Always pass a reference image from `/public/assets/` |
