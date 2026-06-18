import { MELEE, DIR } from '../../config';
import type { Dir, Box } from '../types';

/** Взмах ближнего боя: прямоугольный хитбокс перед игроком на MELEE.life шагов. */
export class MeleeSwing {
  readonly dir: Dir;
  life = MELEE.life;
  readonly damage = MELEE.damage;
  readonly kb = MELEE.knockback;
  readonly box: Box;

  constructor(x: number, y: number, dir: Dir) {
    this.dir = dir;
    const { reach: d, size: s } = MELEE;
    const [dx, dy] = DIR[dir];
    this.box = {
      x: x + (dx > 0 ? d : dx < 0 ? -d - s : -s / 2),
      y: y + (dy > 0 ? d : dy < 0 ? -d - s : -s / 2),
      w: s,
      h: s,
    };
  }

  get alive(): boolean {
    return this.life > 0;
  }
}
