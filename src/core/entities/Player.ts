import { PLAYER, MODE_RANGED, MODE_MELEE } from '../../config';
import { WEAPONS, type WeaponId, type WeaponDef } from '../weapons';
import type { CombatMode, Box, Dir } from '../types';

/**
 * Статы-множители, которые модифицируют базовые характеристики оружия.
 * Все начинают с 1 (нейтрально); пассивные предметы и баффы их меняют.
 * Сделано мультипликативно поверх WeaponDef, чтобы предметы и оружие
 * комбинировались независимо (как в Isaac: апгрейды работают с любым оружием).
 */
export interface PlayerStats {
  /** Множитель урона выстрела/взмаха. */
  damageMul: number;
  /** Множитель скорости атаки (больше → чаще стреляет).Cooldown = base / fireRateMul. */
  fireRateMul: number;
  /** Множитель дальности полёта снаряда (в шагах жизни). */
  rangeMul: number;
  /** Множитель скорости полёта снаряда. */
  shotSpeedMul: number;
}

export const NEUTRAL_STATS: PlayerStats = {
  damageMul: 1,
  fireRateMul: 1,
  rangeMul: 1,
  shotSpeedMul: 1,
};

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

  /** Текущие множители. Меняются предметами/баффами. */
  stats: PlayerStats = { ...NEUTRAL_STATS };

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

  /** Эффективный урон оружия с учётом статов игрока. */
  effectiveDamage(w: WeaponDef): number {
    return w.damage * this.stats.damageMul;
  }

  /** Эффективная перезарядка оружия с учётом скорости атаки. */
  effectiveCooldown(w: WeaponDef): number {
    return Math.max(1, Math.round(w.cooldown / this.stats.fireRateMul));
  }

  /** Подобрать оружие — заменяет текущий экипированный слот. */
  addWeapon(id: WeaponId): void {
    this.weapons[this.equipped] = WEAPONS[id];
    this.mode = WEAPONS[id].type === 'ranged' ? MODE_RANGED : MODE_MELEE;
  }

  /**
   * Увеличить максимальное HP на bonus и подлечить на ту же величину.
   * maxHp readonly снаружи, поэтому меняем через этот метод — он же не
   * позволяет уйти в отрицательные значения.
   */
  growMaxHp(bonus: number): void {
    if (bonus <= 0) return;
    (this as { maxHp: number }).maxHp += bonus;
    this.hp = Math.min(this.maxHp, this.hp + bonus);
  }

  /** Поставить позицию мгновенно, сбросив интерполяцию (телепорт). */
  place(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }
}
