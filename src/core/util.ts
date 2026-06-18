/** Маленькие чистые математические утилиты без состояния. */

import type { Box } from './types';

/** Евклидова дистанция между точками. */
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Пересекаются ли два прямоугольника (AABB). */
export function overlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Ограничить значение отрезком [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Линейная интерполяция (для плавной отрисовки между шагами). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
