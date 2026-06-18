import { MODE_RANGED, MODE_MELEE } from '../constants';
import type { CombatMode, Box, Dir } from '../types';

export class Player {
  x = 0;
  y = 0;
  w = 26;
  h = 26;
  speed = 3.2;
  hp = 6;
  maxHp = 6;
  mode: CombatMode = MODE_RANGED;
  facing: Dir = 'up';
  moveDir: Dir = 'up';
  atkCD = 0;
  invTimer = 0;
  transCD = 0;

  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
}
