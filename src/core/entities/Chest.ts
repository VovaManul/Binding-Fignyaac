import { CHEST } from '../../config';
import type { Box } from '../types';

export class Chest {
  x: number;
  y: number;
  hp: number;
  readonly w = CHEST.size;
  readonly h = CHEST.size;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.hp = CHEST.hp;
  }

  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  get alive(): boolean {
    return this.hp > 0;
  }
}
