import { PLAYER, MODE_RANGED } from '../../config';
import { WEAPONS, type WeaponId, type WeaponDef } from '../weapons';
import type { CombatMode, Box, Dir } from '../types';

/**
 * Игрок. Только данные и геометрия — никакой отрисовки.
 * prevX/prevY хранят позицию на прошлом шаге для плавной интерполяции
 * при рендере (см. render/).
 */
export class Player {
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  readonly w = PLAYER.size;
  readonly h = PLAYER.size;
  readonly speed: number;
  hp: number;
  readonly maxHp: number;
  mode: CombatMode = MODE_RANGED;
  facing: Dir = 'up';   // куда смотрит/целится
  moveDir: Dir = 'up';  // последнее направление движения
  atkCD = 0;            // перезарядка атаки (шаги)
  invTimer = 0;         // неуязвимость (шаги)
  transCD = 0;          // блок перехода между комнатами (шаги)

  /** Ровно 2 слота под оружие. */
  weapons: [WeaponDef, WeaponDef] = [WEAPONS.tears, WEAPONS.melee];
  /** 0 или 1 — какой слот сейчас экипирован. */
  equipped: 0 | 1 = 0;

  /** Переопределения из правил уровня; по умолчанию — баланс из config. */
  constructor(rules: { maxHp?: number; speed?: number } = {}) {
    this.maxHp = rules.maxHp ?? PLAYER.maxHp;
    this.hp = this.maxHp;
    this.speed = rules.speed ?? PLAYER.speed;
  }

  /** Хитбокс с центром в (x, y). */
  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  get currentWeapon(): WeaponDef {
    return this.weapons[this.equipped];
  }

  /** Подобрать оружие — заменяет текущий экипированный слот. */
  addWeapon(id: WeaponId): void {
    this.weapons[this.equipped] = WEAPONS[id];
    this.mode = WEAPONS[id].type === 'ranged' ? MODE_RANGED : 1;
  }

  /** Поставить позицию мгновенно, сбросив интерполяцию (телепорт). */
  place(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }
}
