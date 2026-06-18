import { CW } from '../constants';
import type { RoomMap } from '../room/RoomMap';

const CELL = 14;
const GAP = 2;

/** Draw the 7×7 minimap in the top-right corner */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  map: RoomMap,
  cc: number,
  cr: number,
): void {
  const cs = CELL + GAP;
  const mx = CW - 180;
  const my = 12;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(mx - 8, my - 8, cs * 7 + 16, cs * 7 + 16);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 8, my - 8, cs * 7 + 16, cs * 7 + 16);

  for (let r = -3; r <= 3; r++) {
    for (let c = -3; c <= 3; c++) {
      const room = map.get(cc + c, cr + r);
      if (!room) continue;

      const x = mx + (c + 3) * cs;
      const y = my + (r + 3) * cs;

      let color = '#141414';
      if (room.visited) {
        color = room.type === 'spawn' ? '#2a5a2a'
          : room.type === 'boss' ? '#5a1a1a'
          : room.type === 'treasure' ? '#5a5a1a'
          : '#555';
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL, CELL);

      if (room.visited) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        if (room.doors.up)    ctx.fillRect(x + cs / 2 - 2, y - 2, 4, 3);
        if (room.doors.down)  ctx.fillRect(x + cs / 2 - 2, y + CELL - 1, 4, 3);
        if (room.doors.left)  ctx.fillRect(x - 2, y + cs / 2 - 2, 3, 4);
        if (room.doors.right) ctx.fillRect(x + CELL - 1, y + cs / 2 - 2, 3, 4);
      }

      // Highlight current room
      if (c === 0 && r === 0) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1.5, y - 1.5, CELL + 3, CELL + 3);
      }
    }
  }
}
