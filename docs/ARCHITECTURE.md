# Architecture

## Overview

The game is a single-page Canvas 2D application. The source is written
in TypeScript and split into ~19 modules under `src/`, bundled by Bun
into a single `dist/main.js`. The HTML shell in `dist/index.html` loads
the bundle.

## Module Dependency Graph

```
main.ts
  ├── input.ts           (global KEYS, setupInput)
  └── Game.ts
        ├── constants.ts (all shared numeric constants)
        ├── types.ts     (Dir, RoomType, CombatMode, Box, Doors)
        ├── math.ts      (shuffle, rand, ri, dist, overlap)
        ├── RoomMap.ts   → Room.ts, tiles.ts, doors.ts
        ├── Player.ts
        ├── Enemy.ts
        ├── Tear.ts
        ├── MeleeSwing.ts
        ├── collision.ts → Room.ts, tiles.ts
        ├── transitions.ts → Game.ts (type only), input.ts
        ├── spawner.ts   → Room.ts, Enemy.ts
        └── render/*
              → roomRenderer.ts, entityRenderer.ts,
                hudRenderer.ts, minimapRenderer.ts
```

## Game Loop

Every frame (`requestAnimationFrame`):

1. **Timers** — decrement `invTimer`, `atkCD`, `transCD`
2. **Movement** — read WASD, apply velocity, resolve wall collisions
3. **Attack** — read arrow keys / Space, fire tear or create melee swing
4. **Melee Update** — decrement swing life, apply damage + knockback
5. **Tear Update** — move projectiles, check wall/enemy collisions
6. **Enemy AI** — chase player, contact damage with cooldown
7. **Room Clear** — if all enemies dead → `room.cleared = true`, rebuild tiles with doors
8. **Transition Check** — if player on door tile + key pressed → load adjacent room
9. **Win Check** — if boss room cleared → `won = true`
10. **Render** — draw room tiles → entities → HUD → minimap → overlays

## Transition System

Room transitions are the most complex subsystem. Key design:

- **Door geometry**: `DOOR` constant defines 3-tile-wide openings at
  each cardinal edge (top: cols 6-8, row 0; bottom: cols 6-8, row 10;
  left: rows 4-6, col 0; right: rows 4-6, col 14).
- **Detection**: `checkTransition()` computes the player's tile position
  (`col, row`). If they're on a door tile AND pressing the matching
  movement key, the transition fires.
- **Cooldown**: `transCD = 15` prevents re-entry within 15 frames.
- **Movement lock**: Transition only works in cleared rooms
  (`room.cleared === true`).
- **Collision bypass**: `isBlocked()` returns `false` for out-of-bounds
  tiles at door openings, letting the player's bounding box extend
  beyond the room boundary.

## Collision System

- `isBlocked(room, col, row)` — per-tile check. Returns `true` for
  wall tiles and out-of-bounds positions, except at door openings.
- `collidesWall(box, room, ox, oy)` — iterates all tiles covered by
  the entity's bounding box. If any tile is blocked, returns `true`.
- Movement resolves axis-independently: apply X, revert if collision;
  apply Y, revert if collision.

## Room Generation

`RoomMap.generate()` uses a random walk:

1. Start at (0,0) with a spawn room.
2. Maintain a frontier list of rooms that have room to expand.
3. Each step, pick a random frontier room, shuffle directions, and
   attempt to add a new room in an unoccupied adjacent cell within
   the 7×7 grid.
4. Room types are assigned probabilistically (boss at ~20%, treasure
   at ~12%, rest normal).
5. If no boss room was generated, one normal room is promoted.

## Rendering

Rendering is split into 4 stateless functions, each taking
`CanvasRenderingContext2D` as the first argument:

- **roomRenderer** — tile loop with wall/door/floor styles
- **entityRenderer** — enemies (3 types), player (body + weapon),
  tears, melee swing arc
- **hudRenderer** — HP bar, mode indicator, enemy count, room label
- **minimapRenderer** — 7×7 grid with visited/current room highlights

## Weapon Visuals

- **Pistol (ranged)**: Barrel line + body rect, rotated toward facing
  direction. Muzzle flash circle at `atkCD > 8`.
- **Knife (melee)**: Triangular blade + handle + guard rects, offset
  in facing direction.

## Enemy Types

| Type   | Size | HP | Speed | Damage | Visual |
|--------|------|----|-------|--------|--------|
| Normal | 32px | 3  | 1.15  | 1      | Brown block, yellow eyes |
| Fast   | 26px | 2  | 1.9   | 1      | Red circle, small eyes |
| Boss   | 46px | 10 | 0.9   | 2      | Large red circle, horns, HP bar |

## State Management

- `GAME_OVER` / `WON` — boolean flags checked in loop and render.
- `KEYS` — global mutable map, reset on window blur.
- Room state (`cleared`, `visited`, `enemies[]`, `tears[]`) — per-room.
- Player state (`hp`, `mode`, `facing`, `transCD`, etc.) — single
  `Player` instance.
- Cooldowns (`invTimer`, `atkCD`, `transCD`) decrement each frame.

## Build Pipeline

```
bun build src/main.ts --outdir dist --target browser --minify
cp src/index.html dist/
```

- Bundler: Bun's native bundler (esbuild under the hood).
- Target: browser (ES module → IIFE/global wrapper).
- Result: single `dist/main.js` (~30 KB) + `dist/index.html`.
- Open `dist/index.html` directly in any modern browser.
