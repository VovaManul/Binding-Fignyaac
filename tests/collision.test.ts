import { describe, it, expect } from 'bun:test';
import { isBlocked, collidesWall } from '../src/core/systems/collision';
import { Room } from '../src/core/world/Room';
import { OX, OY, TILE, COLS, ROWS } from '../src/config';

function cleanRoom(): Room {
  const room = new Room(0, 0, 'normal');
  room.doors = { up: true, down: false, left: false, right: false };
  room.cleared = true;
  room.rebuildTiles();
  return room;
}

describe('collision', () => {
  it('стены по краям блокируют движение', () => {
    const room = cleanRoom();
    expect(isBlocked(room, 0, 0)).toBe(true);
    expect(isBlocked(room, COLS - 1, ROWS - 1)).toBe(true);
  });

  it('внутренний пол не блокирует', () => {
    const room = cleanRoom();
    expect(isBlocked(room, 5, 5)).toBe(false);
  });

  it('за пределами комнаты — блок, но дверной проём открыт', () => {
    const room = cleanRoom();
    // Над комнатой (row < 0) обычно стена...
    expect(isBlocked(room, 0, -1)).toBe(true);
    // ...но в колонках двери up проём открыт.
    expect(isBlocked(room, 7, -1)).toBe(false);
  });

  it('collidesWall ловит хитбокс на стене и пропускает на полу', () => {
    const room = cleanRoom();
    const insideFloor = { x: OX + 5 * TILE, y: OY + 5 * TILE, w: 26, h: 26 };
    expect(collidesWall(insideFloor, room)).toBe(false);

    const onWall = { x: OX - 5, y: OY - 5, w: 26, h: 26 };
    expect(collidesWall(onWall, room)).toBe(true);
  });
});
