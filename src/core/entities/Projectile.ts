import { PROJECTILE } from '../../config';

/** Снаряд игрока («слеза»). Летит по прямой, пока не врежется или не истечёт life. */
export class Projectile {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  dx: number;
  dy: number;
  readonly r = PROJECTILE.radius;
  readonly speed = PROJECTILE.speed;
  readonly damage = PROJECTILE.damage;
  life = PROJECTILE.life;

  constructor(x: number, y: number, dx: number, dy: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.dx = dx;
    this.dy = dy;
  }

  get alive(): boolean {
    return this.life > 0;
  }
}
