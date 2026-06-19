import type { Box } from '../types';
import type { WeaponId } from '../weapons';

export class WeaponPickup {
  x: number;
  y: number;
  readonly weaponId: WeaponId;
  readonly w = 30;
  readonly h = 30;

  constructor(x: number, y: number, weaponId: WeaponId) {
    this.x = x;
    this.y = y;
    this.weaponId = weaponId;
  }

  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
}
