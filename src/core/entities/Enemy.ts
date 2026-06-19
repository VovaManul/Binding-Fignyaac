import { ENEMY_STATS } from '../../config';
import type { Box, EnemyType } from '../types';

/**
 * Враг. Характеристики берутся из таблицы ENEMY_STATS по типу.
 * Чтобы добавить новый тип врага — допиши строку в ENEMY_STATS (config.ts)
 * и тип в EnemyType (core/types.ts). Логика и спавн подхватят автоматически.
 */
export class Enemy {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  readonly type: EnemyType;
  readonly w: number;
  readonly h: number;
  hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly damage: number;
  knx = 0;            // отбрасывание по X
  kny = 0;            // отбрасывание по Y
  hitTimer = 0;       // мигание при попадании (шаги)
  atkTimer = 0;       // перезарядка контактного удара (шаги)
  burnTimer = 0;      // тиков до конца горения (0 = не горит)
  burnDamage = 1;     // урон за тик горения
  burnInterval = 10;  // как часто горение наносит урон
  chargeTimer = 0;    // перезарядка рывка для charger (шаги)
  shootTimer = 0;     // перезарядка стрельбы для shooter (шаги)
  phase = 1;          // фаза босса (мультифазные боссы на этажах 5/10/15)
  phaseChanged = false; // флаг для рендера (сброс на след. шаге)
  spawnTimer = 0;     // перезарядка спавна миньонов для босса

  /**
   * mods — множители из правил уровня (см. core/rules.ts). По умолчанию 1,
   * поэтому `new Enemy(x, y, type)` даёт базовый баланс из ENEMY_STATS.
   */
  constructor(x: number, y: number, type: EnemyType, mods: { hpMul?: number; speedMul?: number } = {}) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.type = type;
    const s = ENEMY_STATS[type];
    this.w = s.size;
    this.h = s.size;
    this.maxHp = Math.max(1, Math.round(s.hp * (mods.hpMul ?? 1)));
    this.hp = this.maxHp;
    this.speed = s.speed * (mods.speedMul ?? 1);
    this.damage = s.damage;
  }

  get box(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  get alive(): boolean {
    return this.hp > 0;
  }
}
