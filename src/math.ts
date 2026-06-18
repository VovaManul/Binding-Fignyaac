/** Fisher-Yates shuffle (mutates array in place) */
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * i) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random float in [a, b) */
export function rand(a: number, b: number): number {
  return Math.random() * (b - a) + a;
}

/** Random integer in [a, b] inclusive */
export function ri(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

/** Euclidean distance */
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Axis-aligned bounding box overlap test */
export function overlap(a: { x: number; y: number; w: number; h: number },
                        b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
