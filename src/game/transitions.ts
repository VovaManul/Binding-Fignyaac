import { OX, OY, TILE, COLS, ROWS, DOOR } from '../constants';
import type { Dir } from '../types';
import type { Game } from './Game';
import { KEYS } from '../input';

/** Entry direction → movement keys that trigger a transition */
const ENTRY_KEYS: Record<string, string[]> = {
  up:    ['w', 'W', 'ArrowUp'],
  down:  ['s', 'S', 'ArrowDown'],
  left:  ['a', 'A', 'ArrowLeft'],
  right: ['d', 'D', 'ArrowRight'],
};

function keyPressed(dir: Dir): boolean {
  for (const k of ENTRY_KEYS[dir]) {
    if (KEYS[k]) return true;
  }
  return false;
}

/**
 * Called every frame from Game.tick().
 * If the player stands on a cleared room's door tile and presses
 * the matching movement key, transition into the adjacent room.
 */
export function checkTransition(game: Game): void {
  if (game.gameOver || game.won) return;
  if (game.player.transCD > 0) return;

  const p = game.player;
  const room = game.curRoom;
  if (!room.cleared) return;

  const col = Math.floor((p.x - OX) / TILE);
  const row = Math.floor((p.y - OY) / TILE);

  // Top door
  if (row === 0 && room.doors.up && DOOR.up.cols.includes(col) && keyPressed('up')) {
    if (game.roomMap.has(game.cc, game.cr - 1)) {
      game.cr--;
      game.enterRoom('down');
      return;
    }
  }

  // Bottom door
  if (row === ROWS - 1 && room.doors.down && DOOR.down.cols.includes(col) && keyPressed('down')) {
    if (game.roomMap.has(game.cc, game.cr + 1)) {
      game.cr++;
      game.enterRoom('up');
      return;
    }
  }

  // Left door
  if (col === 0 && room.doors.left && DOOR.left.rows.includes(row) && keyPressed('left')) {
    if (game.roomMap.has(game.cc - 1, game.cr)) {
      game.cc--;
      game.enterRoom('right');
      return;
    }
  }

  // Right door
  if (col === COLS - 1 && room.doors.right && DOOR.right.rows.includes(row) && keyPressed('right')) {
    if (game.roomMap.has(game.cc + 1, game.cr)) {
      game.cc++;
      game.enterRoom('left');
      return;
    }
  }
}
