import type { Box } from '../types';
import type { WeaponId } from '../weapons';
import type { ItemId } from '../items';

/** Что выпало из сундука: новое оружие ИЛИ пассивный предмет. */
export type PickupKind = 'weapon' | 'item';

/**
 * Пикап на полу. Может быть либо оружие (заменяет экипированный слот),
 * либо пассивный предмет (модифицирует статы игрока при подборе).
 */
export class Pickup {
  x: number;
  y: number;
  readonly kind: PickupKind;
  /** ID оружия, если kind === 'weapon'. */
  readonly weaponId?: WeaponId;
  /** ID предмета, если kind === 'item'. */
  readonly itemId?: ItemId;
  readonly w = 30;
  readonly h = 30;

  private constructor(x: number, y: number, kind: PickupKind, weaponId?: WeaponId, itemId?: ItemId) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.weaponId = weaponId;
    this.itemId = itemId;
  }

  static weapon(x: number, y: number, weaponId: WeaponId): Pickup {
    return new Pickup(x, y, 'weapon', weaponId);
  }

  static item(x: number, y: number, itemId: ItemId): Pickup {
    return new Pickup(x, y, 'item', undefined, itemId);
  }

  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
}

/**
 * @deprecated Используйте Pickup. WeaponPickup оставлен как псевдоним для
 * обратной совместимости со старым кодом/тестами.
 */
export const WeaponPickup = Pickup;
