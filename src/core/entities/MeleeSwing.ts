import { MELEE, DIR } from '../../config';
import type { Dir, Box } from '../types';

/** Взмах ближнего боя: прямоугольный хитбокс перед игроком на life шагов. */
export class MeleeSwing {
  readonly dir: Dir;
  life = MELEE.life;
  readonly maxLife: number;
  readonly damage: number;
  readonly kb: number;
  readonly box: Box;

  constructor(x: number, y: number, dir: Dir, overrides?: { damage?: number; knockback?: number; life?: number; sizeMul?: number }) {
    this.dir = dir;
    this.damage = overrides?.damage ?? MELEE.damage;
    this.kb = overrides?.knockback ?? MELEE.knockback;
    if (overrides?.life !== undefined) this.life = overrides.life;
    this.maxLife = this.life;
    const { reach: d } = MELEE;
    const size = MELEE.size * (overrides?.sizeMul ?? 1);
    const [dx, dy] = DIR[dir];
    this.box = {
      x: x + (dx > 0 ? d : dx < 0 ? -d - size : -size / 2),
      y: y + (dy > 0 ? d : dy < 0 ? -d - size : -size / 2),
      w: size,
      h: size,
    };
  }

  get alive(): boolean {
    return this.life > 0;
  }
}
