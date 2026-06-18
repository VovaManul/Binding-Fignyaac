import type { Dir, Box } from '../types';
import { DIR } from '../constants';

export class MeleeSwing {
  dir: Dir;
  life = 10;
  damage = 2;
  kb = 10;
  box: Box;

  constructor(x: number, y: number, dir: Dir) {
    this.dir = dir;
    const d = 22;
    const s = 50;
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
