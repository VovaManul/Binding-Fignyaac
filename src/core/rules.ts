/**
 * rules.ts — ПРАВИЛА УРОВНЯ (конфигурация забега).
 *
 * Мир по-прежнему генерируется процедурно (каждый забег — новый), но теперь
 * параметризуется набором правил: размер данжена, плотность и сила врагов,
 * здоровье игрока, фиксированный seed. На старте игрок выбирает один из
 * пресетов (меню), и `Game` создаётся с этими правилами.
 *
 * Как добавить свой уровень: допиши объект в PRESETS — он сразу появится в меню.
 * Геометрия (размер тайла/комнаты, геометрия дверей) остаётся в config.ts: это
 * не «правила уровня», а константы движка.
 */
import { PLAYER, ENEMY, MIN_ROOMS, EXTRA_ROOMS, MAP_RADIUS, FLOOR_SCALING } from '../config';

export interface LevelRules {
  /** Машинный id (для сохранений/выбора). */
  id: string;
  /** Название для меню. */
  name: string;
  /** Короткое описание для меню. */
  description: string;
  /** Фиксированный seed генерации. undefined → случайный каждый забег. */
  seed?: number;
  /** Бесконечный спуск: после босса — новый этаж с усилением, а не победа. */
  endless?: boolean;

  /** Параметры генерации карты. */
  map: {
    minRooms: number;
    extraRooms: number;
    mapRadius: number;
  };

  /** Параметры игрока. */
  player: {
    maxHp: number;
    speed: number;
  };

  /** Параметры врагов (множители поверх базовых из config.ENEMY_STATS). */
  enemies: {
    densityMul: number; // множитель числа врагов в обычной комнате
    fastChance: number; // доля быстрых врагов
    hpMul: number;      // множитель HP всех врагов
    speedMul: number;   // множитель скорости
    bossHpMul: number;  // отдельный множитель HP босса
  };
}

/** Базовые правила = текущий «ванильный» баланс из config. */
export const DEFAULT_RULES: LevelRules = {
  id: 'standard',
  name: 'Стандарт',
  description: 'Классический забег. Сбалансированный данжен.',
  map: { minRooms: MIN_ROOMS, extraRooms: EXTRA_ROOMS, mapRadius: MAP_RADIUS },
  player: { maxHp: PLAYER.maxHp, speed: PLAYER.speed },
  enemies: { densityMul: 1, fastChance: ENEMY.fastChance, hpMul: 1, speedMul: 1, bossHpMul: 1 },
};

/** Пресеты для меню. Первый — по умолчанию. */
export const PRESETS: LevelRules[] = [
  DEFAULT_RULES,
  {
    id: 'big',
    name: 'Большой данжен',
    description: 'Больше комнат — длиннее забег.',
    map: { minRooms: 14, extraRooms: 6, mapRadius: 4 },
    player: { maxHp: PLAYER.maxHp, speed: PLAYER.speed },
    enemies: { densityMul: 1, fastChance: ENEMY.fastChance, hpMul: 1, speedMul: 1, bossHpMul: 1 },
  },
  {
    id: 'hardcore',
    name: 'Хардкор',
    description: 'Мало HP, больше быстрых и живучих врагов.',
    map: { minRooms: MIN_ROOMS, extraRooms: EXTRA_ROOMS, mapRadius: MAP_RADIUS },
    player: { maxHp: 3, speed: PLAYER.speed },
    enemies: { densityMul: 1.5, fastChance: 0.55, hpMul: 1.4, speedMul: 1.15, bossHpMul: 1.5 },
  },
  {
    id: 'explorer',
    name: 'Исследователь',
    description: 'Мирно: много HP, мало слабых врагов — просто ходить и изучать.',
    map: { minRooms: 12, extraRooms: 4, mapRadius: 4 },
    player: { maxHp: 10, speed: PLAYER.speed * 1.1 },
    enemies: { densityMul: 0.5, fastChance: 0.15, hpMul: 0.7, speedMul: 0.9, bossHpMul: 0.8 },
  },
  {
    id: 'daily',
    name: 'Фикс-сид',
    description: 'Один и тот же данжен каждый раз (seed=2026) — удобно тренироваться.',
    seed: 2026,
    map: { minRooms: MIN_ROOMS, extraRooms: EXTRA_ROOMS, mapRadius: MAP_RADIUS },
    player: { maxHp: PLAYER.maxHp, speed: PLAYER.speed },
    enemies: { densityMul: 1, fastChance: ENEMY.fastChance, hpMul: 1, speedMul: 1, bossHpMul: 1 },
  },
  {
    id: 'endless',
    name: 'Бесконечный спуск',
    description: 'После босса — спуск на новый этаж. Враги сильнее, комнат больше. HP и оружие сохраняются.',
    endless: true,
    map: { minRooms: MIN_ROOMS, extraRooms: EXTRA_ROOMS, mapRadius: MAP_RADIUS },
    player: { maxHp: PLAYER.maxHp, speed: PLAYER.speed },
    enemies: { densityMul: 1, fastChance: ENEMY.fastChance, hpMul: 1, speedMul: 1, bossHpMul: 1 },
  },
];

/**
 * Возвращает правила для указанного этажа на основе базовых правил.
 * С каждым этажом враги сильнее и комнат больше.
 */
export function scaleRulesForFloor(base: LevelRules, floor: number): LevelRules {
  const f = floor - 1;
  const cap = (v: number): number => Math.round(v * 100) / 100;
  return {
    ...base,
    map: {
      ...base.map,
      minRooms: base.map.minRooms + f * FLOOR_SCALING.roomsPerFloor,
      mapRadius: Math.min(base.map.mapRadius + Math.floor(f / 3), 6),
    },
    enemies: {
      densityMul: cap(base.enemies.densityMul + f * FLOOR_SCALING.densityMulPerFloor),
      fastChance: Math.min(base.enemies.fastChance + f * FLOOR_SCALING.fastChancePerFloor, 0.8),
      hpMul: cap(base.enemies.hpMul + f * FLOOR_SCALING.hpMulPerFloor),
      speedMul: cap(base.enemies.speedMul + f * FLOOR_SCALING.speedMulPerFloor),
      bossHpMul: cap(base.enemies.bossHpMul + f * FLOOR_SCALING.bossHpMulPerFloor),
    },
    endless: true,
  };
}
