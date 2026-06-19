export type WeaponId = 'tears' | 'melee' | 'shotgun' | 'axe' | 'staff' | 'whip' | 'bomb' | 'boomerang' | 'laser';

export type ProjectileType = 'tear' | 'fireball' | 'bomb' | 'boomerang' | 'laser' | 'beam';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  type: 'ranged' | 'melee';
  damage: number;
  cooldown: number;
  projectileType?: ProjectileType;
  spreadCount?: number;
  /** Угол бокового отклонения каждого снаряда при spreadCount > 1 (доля от перпендикуляра). */
  spread?: number;
  swingSizeMul?: number;
  swingLife?: number;
  knockback?: number;
  fireDmg?: number;
  fireInterval?: number;
  fireDuration?: number;
  explosionRadius?: number;  // для бомбы
  beamLife?: number;         // длительность лазерного луча
  beamRadius?: number;       // радиус поражения луча
  beamTickDmg?: number;      // урон за тик луча
  beamRange?: number;        // дальность постановки центра луча от игрока
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  tears: { id: 'tears', name: 'Слёзы', type: 'ranged', damage: 1, cooldown: 10, projectileType: 'tear' },
  melee: { id: 'melee', name: 'Кулак', type: 'melee', damage: 2, cooldown: 22 },
  shotgun: { id: 'shotgun', name: 'Дробовик', type: 'ranged', damage: 1, cooldown: 18, projectileType: 'tear', spreadCount: 3, spread: 0.15 },
  axe: { id: 'axe', name: 'Топор', type: 'melee', damage: 4, cooldown: 35, swingSizeMul: 1.5, swingLife: 15, knockback: 15 },
  staff: { id: 'staff', name: 'Посох', type: 'ranged', damage: 1, cooldown: 20, projectileType: 'fireball', fireDmg: 1, fireInterval: 10, fireDuration: 50 },
  whip: { id: 'whip', name: 'Хлыст', type: 'melee', damage: 3, cooldown: 18, swingSizeMul: 2.5, swingLife: 12, knockback: 16 },
  bomb: { id: 'bomb', name: 'Бомба', type: 'ranged', damage: 0, cooldown: 35, projectileType: 'bomb', explosionRadius: 80 },
  boomerang: { id: 'boomerang', name: 'Бумеранг', type: 'ranged', damage: 2, cooldown: 25, projectileType: 'boomerang' },
  laser: {
    id: 'laser', name: 'Лазер', type: 'ranged', damage: 1, cooldown: 20,
    projectileType: 'beam', beamLife: 12, beamRadius: 44, beamTickDmg: 2, beamRange: 70,
  },
};
