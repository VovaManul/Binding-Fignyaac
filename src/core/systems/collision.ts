import { ROWS, COLS, DOOR, TILE, OX, OY, T_WALL } from '../../config';
import type { Room } from '../world/Room';
import type { Box } from '../types';

/**
 * Заблокирован ли тайл (col, row) для движения.
 * В дверных проёмах граница комнаты «прозрачна» — это позволяет хитбоксу
 * заехать за край и встать на дверь для перехода в соседнюю комнату.
 */
export function isBlocked(room: Room, col: number, row: number): boolean {
  if (row < 0 && room.doors.up && DOOR.up.cols.includes(col)) return false;
  if (row >= ROWS && room.doors.down && DOOR.down.cols.includes(col)) return false;
  if (col < 0 && room.doors.left && DOOR.left.rows.includes(row)) return false;
  if (col >= COLS && room.doors.right && DOOR.right.rows.includes(row)) return false;

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return room.tiles[row][col] === T_WALL;
}

/** Пересекает ли хитбокс хотя бы один заблокированный тайл. */
export function collidesWall(box: Box, room: Room): boolean {
  const left = Math.floor((box.x - OX) / TILE);
  const right = Math.floor((box.x + box.w - OX) / TILE);
  const top = Math.floor((box.y - OY) / TILE);
  const bottom = Math.floor((box.y + box.h - OY) / TILE);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (isBlocked(room, col, row)) return true;
    }
  }
  return false;
}
