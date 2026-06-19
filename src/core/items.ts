/**
 * items.ts — пассивные предметы (как в Isaac).
 *
 * Предмет модифицирует статы игрока (damageMul, fireRateMul и т.д.).
 * В отличие от оружия (которое занимает слот и определяет тип атаки),
 * предметов можно собрать сколько угодно — они стакаются в общей сумме
 * статов. Это база для «билдов»: чувак, накопивший +damage и +fireRate,
 * к боссу придёт совсем с другой огневой мощью.
 */
import type { PlayerStats } from './entities/Player';

export type ItemId =
  | 'sad-onion'      // +скорострельность
  | 'cricket-head'   // +урон
  | 'lemon-mishap'   // +дальность
  | 'lucky-toe'      // +всё понемногу
  | 'blood-penny'    // +HP
  | 'speed-ball';    // +скорость полёта снаряда

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  /** Изменения стат, которые применяются при подборе. */
  stats?: Partial<PlayerStats>;
  /** Сколько добавить к максимальному HP (и текущему). */
  maxHpBonus?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  'sad-onion': {
    id: 'sad-onion', name: 'Грустный лук',
    description: '+35% к скорострельности.',
    stats: { fireRateMul: 0.35 }, // это дельта, применяется как += 0.35
  },
  'cricket-head': {
    id: 'cricket-head', name: 'Голова сверчка',
    description: '+50% к урону.',
    stats: { damageMul: 0.5 },
  },
  'lemon-mishap': {
    id: 'lemon-mishap', name: 'Лимонная неприятность',
    description: '+60% к дальности.',
    stats: { rangeMul: 0.6 },
  },
  'speed-ball': {
    id: 'speed-ball', name: 'Скоростной шар',
    description: '+40% к скорости снаряда.',
    stats: { shotSpeedMul: 0.4 },
  },
  'lucky-toe': {
    id: 'lucky-toe', name: 'Счастливый палец',
    description: '+15% урон, +15% скорострельность.',
    stats: { damageMul: 0.15, fireRateMul: 0.15 },
  },
  'blood-penny': {
    id: 'blood-penny', name: 'Кровавый пенс',
    description: '+2 к макс. HP и лечит на 2.',
    maxHpBonus: 2,
  },
};

/** Все айдishники предметов — для случайного дропа. */
export const ALL_ITEM_IDS: readonly ItemId[] = Object.keys(ITEMS) as ItemId[];

/**
 * Применить предмет к статам/игроку. Используется при подборе.
 * Стаки: каждый предмет модифицирует текущие множители дельтой.
 */
export function applyItem(stats: PlayerStats, item: ItemDef, onMaxHp: (bonus: number) => void): void {
  if (item.stats) {
    if (item.stats.damageMul) stats.damageMul += item.stats.damageMul;
    if (item.stats.fireRateMul) stats.fireRateMul += item.stats.fireRateMul;
    if (item.stats.rangeMul) stats.rangeMul += item.stats.rangeMul;
    if (item.stats.shotSpeedMul) stats.shotSpeedMul += item.stats.shotSpeedMul;
  }
  if (item.maxHpBonus) onMaxHp(item.maxHpBonus);
}
