import { T_WALL, T_FLOOR, T_DOOR, COLS, ROWS, DOOR } from '../constants';
import type { Doors } from '../types';

export { T_WALL, T_FLOOR, T_DOOR };

/** Build a fresh tile grid (all edge tiles = wall, interior = floor) */
export function buildTiles(doorState?: Doors): number[][] {
  const tiles: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    tiles[r] = [];
    for (let c = 0; c < COLS; c++) {
      tiles[r][c] = (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ? T_WALL : T_FLOOR;
    }
  }
  if (doorState) placeDoors(tiles, doorState);
  return tiles;
}

/** Mark door tiles on an existing tile grid */
export function placeDoors(tiles: number[][], doors: Doors): void {
  if (doors.up)    for (const c of DOOR.up.cols)    tiles[DOOR.up.row][c]    = T_DOOR;
  if (doors.down)  for (const c of DOOR.down.cols)  tiles[DOOR.down.row][c]  = T_DOOR;
  if (doors.left)  for (const r of DOOR.left.rows)  tiles[r][DOOR.left.col]  = T_DOOR;
  if (doors.right) for (const r of DOOR.right.rows) tiles[r][DOOR.right.col] = T_DOOR;
}
