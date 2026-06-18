import { OX, OY, TILE, COLS, ROWS, RW, RH } from '../constants';
import { T_WALL, T_DOOR } from '../room/tiles';
import type { Room } from '../room/Room';

/** Draw the tile grid and wall overlays for a room */
export function drawRoom(ctx: CanvasRenderingContext2D, room: Room): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = OX + c * TILE;
      const y = OY + r * TILE;
      const t = room.tiles[r][c];

      if (t === T_WALL) {
        ctx.fillStyle = '#1a1a24';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#242436';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = '#1e1e2c';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);

        ctx.strokeStyle = '#161620';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + TILE / 2);
        ctx.lineTo(x + TILE, y + TILE / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + TILE / 2, y);
        ctx.lineTo(x + TILE / 2, y + TILE / 2);
        ctx.stroke();
      } else if (t === T_DOOR) {
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#2a1e0e';
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        ctx.fillStyle = '#3a2e14';
        ctx.fillRect(x + 10, y + 10, TILE - 20, TILE - 20);
      } else {
        const dark = (r + c) % 2 === 0;
        ctx.fillStyle = dark ? '#2e2e24' : '#353528';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }

  // Border stroke
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(OX, OY, RW, RH);
}
