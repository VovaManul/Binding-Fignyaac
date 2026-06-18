import { T_WALL, T_FLOOR, T_DOOR, COLS, ROWS, DOOR } from '../../config';
import type { Doors } from '../types';

/**
 * Строит свежую сетку тайлов комнаты: по краям стены, внутри пол.
 * Если передан doorState — в стенах прорезаются дверные проёмы.
 */
export function buildTiles(doorState?: Doors): number[][] {
  const tiles: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    tiles[r] = [];
    for (let c = 0; c < COLS; c++) {
      const isEdge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
      tiles[r][c] = isEdge ? T_WALL : T_FLOOR;
    }
  }
  if (doorState) placeDoors(tiles, doorState);
  return tiles;
}

/** Помечает дверные тайлы на готовой сетке согласно набору открытых дверей. */
export function placeDoors(tiles: number[][], doors: Doors): void {
  if (doors.up) for (const c of DOOR.up.cols) tiles[DOOR.up.row][c] = T_DOOR;
  if (doors.down) for (const c of DOOR.down.cols) tiles[DOOR.down.row][c] = T_DOOR;
  if (doors.left) for (const r of DOOR.left.rows) tiles[r][DOOR.left.col] = T_DOOR;
  if (doors.right) for (const r of DOOR.right.rows) tiles[r][DOOR.right.col] = T_DOOR;
}
