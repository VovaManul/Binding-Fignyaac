import { collidesWall } from './collision';
import type { Room } from '../world/Room';
import type { Box } from '../types';

/**
 * Сущность с прямоугольным хитбоксом и позицией, пригодная для скользящего
 * перемещения (движение разрешается по осям раздельно, скользя вдоль стен).
 */
export interface Movable {
  x: number;
  y: number;
  box: Box;
}

/**
 * Сдвинуть сущность на (dx, dy) с разрешением коллизий по осям раздельно.
 * Применяет X (откатывая при столкновении), затем Y — это даёт «скольжение»
 * вдоль стен. Игрок, враги, боссы — все ходят через эту функцию, чтобы
 * поведение у стен было единым.
 */
export function moveEntity(e: Movable, dx: number, dy: number, room: Room): void {
  e.x += dx;
  if (collidesWall(e.box, room)) e.x -= dx;
  e.y += dy;
  if (collidesWall(e.box, room)) e.y -= dy;
}
