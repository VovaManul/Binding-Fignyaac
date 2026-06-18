import { ROWS, COLS, DOOR } from '../constants';
import { T_WALL } from '../room/tiles';
import type { Room } from '../room/Room';
import type { Box } from '../types';

/** Check if a given tile is blocked for movement */
export function isBlocked(room: Room, col: number, row: number): boolean {
  // Allow passing through the room boundary at door openings
  if (row < 0 && room.doors.up && DOOR.up.cols.includes(col)) return false;
  if (row >= ROWS && room.doors.down && DOOR.down.cols.includes(col)) return false;
  if (col < 0 && room.doors.left && DOOR.left.rows.includes(row)) return false;
  if (col >= COLS && room.doors.right && DOOR.right.rows.includes(row)) return false;

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return room.tiles[row][col] === T_WALL;
}

/** Test whether an entity's bounding box overlaps any wall tile */
export function collidesWall(box: Box, room: Room, ox: number, oy: number): boolean {
  const l = Math.floor((box.x - ox) / TILE_SIZE);
  const r = Math.floor((box.x + box.w - ox) / TILE_SIZE);
  const t = Math.floor((box.y - oy) / TILE_SIZE);
  const b = Math.floor((box.y + box.h - oy) / TILE_SIZE);

  for (let row = t; row <= b; row++) {
    for (let col = l; col <= r; col++) {
      if (isBlocked(room, col, row)) return true;
    }
  }
  return false;
}

const TILE_SIZE = 44; // matches TILE in constants — duplicated to avoid circular dep
