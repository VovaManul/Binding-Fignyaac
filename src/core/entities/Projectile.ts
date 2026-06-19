import { PROJECTILE } from '../../config';
import type { ProjectileType } from '../types';

/** Снаряд. Летит по прямой, пока не врежется или не истечёт life. */
export class Projectile {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  dx: number;
  dy: number;
  readonly type: ProjectileType;
  readonly r = PROJECTILE.radius;
  speed = PROJECTILE.speed;
  damage = PROJECTILE.damage;
  life = PROJECTILE.life;
  hostile = false; // true = вражеский снаряд, бьёт игрока
  burnDuration = 0;
  burnDamage = 1;
  burnInterval = 10;
  explosionRadius = 0;
  beamRadius = 0;

  constructor(x: number, y: number, dx: number, dy: number, type: ProjectileType = 'tear') {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.dx = dx;
    this.dy = dy;
    this.type = type;
  }

  get alive(): boolean {
    return this.life > 0;
  }
}
