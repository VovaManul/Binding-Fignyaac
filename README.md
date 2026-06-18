# Dungeon Crawl — Ranged / Melee

A dark fantasy dungeon crawler inspired by *The Binding of Isaac*.
Built with TypeScript and Canvas 2D, bundled with **Bun**.

## Quick Start

```bash
bun install        # install deps (none currently required)
bun start          # production build → dist/
open dist/index.html
```

Or for development with live reload:

```bash
bun run dev        # starts dev server at http://localhost:3000 + watch mode
```

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Arrow keys | Attack in direction |
| Space | Attack in facing direction |
| Tab / Q | Switch weapon (Ranged ↔ Melee) |
| R | Restart (on Game Over / Victory) |

## Weapons

| Mode | Weapon | Speed | Damage | Effect |
|---|---|---|---|---|
| Ranged | Pistol | Fast (10cd) | 1 per shot | Ranged projectiles |
| Melee | Knife | Slow (22cd) | 2 + knockback | Wide swing arc |

## Room Types

| Type | Description |
|---|---|
| Spawn | Starting room, no enemies |
| Normal | 2–4 enemies |
| Treasure | No enemies, loot room |
| Boss | 1 boss enemy, clearing wins the game |

## Project Structure

```
src/
├── main.ts              Entry point
├── constants.ts         Grid, canvas, tile/door constants
├── types.ts             Shared TypeScript types
├── math.ts              Utility: shuffle, rand, dist, overlap
├── input.ts             Keyboard state (global KEYS map)
├── doors.ts             Door geometry helpers
├── room/
│   ├── Room.ts          Room class (tiles, enemies, tears)
│   ├── RoomMap.ts       Map generation (connected 7×7 grid)
│   └── tiles.ts         Tile builders (wall/floor/door placement)
├── entities/
│   ├── Player.ts        Player stat block
│   ├── Enemy.ts         Enemy stat block + enemy type logic
│   ├── Tear.ts          Ranged projectile
│   └── MeleeSwing.ts    Melee hitbox
├── game/
│   ├── Game.ts          Main orchestrator (loop, tick, render)
│   ├── collision.ts     Wall collision (isBlocked, collidesWall)
│   ├── transitions.ts   Room transition detection
│   └── spawner.ts       Enemy placement logic
└── render/
    ├── roomRenderer.ts      Tile rendering
    ├── entityRenderer.ts    Player, enemy, tear, melee drawing
    ├── hudRenderer.ts       HP bar, mode indicator, HUD
    └── minimapRenderer.ts   Minimap drawing
```

## Build System

- **Bun** — runtime + bundler
- `bun build` — bundles `src/main.ts` → `dist/main.js`
- `build.ts` — production build with minification + HTML copy
- No external libraries required (pure Canvas 2D)

## Architecture

- **Game** owns the game loop (`requestAnimationFrame`), the world
  (`RoomMap`, `Player`), and dispatches to render functions.
- **Tick** processes input → movement → attack → enemy AI → room
  clear check → transitions → win condition.
- **Transitions** check player tile position + keypress against door
  geometry; call `Game.enterRoom()` which resets room state.
- **Collision** allows bounding-box overlap at door openings (row/col
  outside normal bounds).
- **Rendering** is split into 4 pure functions that receive `ctx` + data.
