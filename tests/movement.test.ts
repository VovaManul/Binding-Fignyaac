import { describe, it, expect } from 'bun:test';
import { OX, OY, TILE, COLS, ROWS } from '../src/config';
import { Room } from '../src/core/world/Room';
import { moveEntity, type Movable } from '../src/core/systems/movement';

/** Минимальный movable, на котором удобно тестировать moveEntity. */
function box(x: number, y: number, size = 20): Movable & { x: number; y: number } {
  const obj: Movable & { x: number; y: number } = {
    x, y,
    get box() {
      return { x: this.x - size / 2, y: this.y - size / 2, w: size, h: size };
    },
  };
  return obj;
}

/** Свежая зачищенная комната: двери открыты, по периметру стены. */
function makeRoom() {
  const r = new Room(0, 0, 'spawn');
  r.cleared = true;
  r.rebuildTiles();
  return r;
}

describe('moveEntity', () => {
  it('свободно двигается по полу', () => {
    const room = makeRoom();
    const cx = OX + (COLS / 2) * TILE;
    const cy = OY + (ROWS / 2) * TILE;
    const e = box(cx, cy);
    moveEntity(e, 10, 5, room);
    expect(e.x).toBe(cx + 10);
    expect(e.y).toBe(cy + 5);
  });

  it('не проходит сквозь стену по X, но Y применяется (скольжение)', () => {
    const room = makeRoom();
    const x = OX + 3 * TILE;
    const y = OY + (ROWS / 2) * TILE;
    const e = box(x, y, 16);
    // Большой рывок влево — хитбокс вылетит за col=0, isBlocked вернётся true.
    moveEntity(e, -500, 10, room);
    expect(e.x).toBe(x); // откатилось
    expect(e.y).toBe(y + 10); // применилось
  });

  it('не проходит сквозь стену по Y, X применяется', () => {
    const room = makeRoom();
    const x = OX + (COLS / 2) * TILE;
    const y = OY + 3 * TILE;
    const e = box(x, y, 16);
    moveEntity(e, 7, -500, room);
    expect(e.x).toBe(x + 7);
    expect(e.y).toBe(y);
  });

  it('ни X, ни Y не применяются, если в углу', () => {
    const room = makeRoom();
    const x = OX + 3 * TILE;
    const y = OY + 3 * TILE;
    const e = box(x, y, 16);
    moveEntity(e, -200, -200, room);
    expect(e.x).toBe(x);
    expect(e.y).toBe(y);
  });
});
