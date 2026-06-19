import type { Dir } from '../core/types';

/**
 * Снимок намерений игрока за один опрос ввода — абстракция над «железом».
 * Игровая логика (core/Game.ts) читает ТОЛЬКО это, ничего не зная про
 * клавиатуру. Захочешь геймпад или сенсор — просто сделай ещё один
 * контроллер, отдающий такой же InputState.
 *
 * Поля делятся на два вида:
 *  • удерживаемые (move*, aimVec, attackHeld) — читаются каждый шаг симуляции;
 *  • однократные «edge» (toggleWeapon, restart) — срабатывают один раз на нажатие.
 */
export interface InputState {
  moveX: number;        // -1 влево, +1 вправо, 0 нет
  moveY: number;        // -1 вверх, +1 вниз, 0 нет
  /**
   * Вектор прицеливания (например, из стрелок). Может быть диагональным:
   * {1,-1} = вверх-вправо. null = игрок не целится явным образом. Не обязан
   * быть нормализованным — приведением займётся логика.
   */
  aimVec: { x: number; y: number } | null;
  attackHeld: boolean;  // атака «по ходу движения» (пробел)
  toggleWeapon: boolean; // сменить оружие (однократно)
  restart: boolean;      // рестарт на экране конца игры (однократно)
  openInventory: boolean; // открыть инвентарь (однократно, E)
}

/** Любой источник ввода для игрового цикла: клавиатура, геймпад, бот, тест. */
export interface InputSource {
  poll(): InputState;
}

/** Нейтральный снимок — ничего не нажато. */
export function emptyInput(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimVec: null,
    attackHeld: false,
    toggleWeapon: false,
    restart: false,
    openInventory: false,
  };
}

/**
 * True, если вектор прицеливания или движения указывает в сторону dir.
 * Нужно для переходов между комнатами (можно жать стрелку ИЛИ движение).
 */
export function pressingDir(input: InputState, dir: Dir): boolean {
  switch (dir) {
    case 'up':    return input.moveY < 0 || (!!input.aimVec && input.aimVec.y < 0);
    case 'down':  return input.moveY > 0 || (!!input.aimVec && input.aimVec.y > 0);
    case 'left':  return input.moveX < 0 || (!!input.aimVec && input.aimVec.x < 0);
    case 'right': return input.moveX > 0 || (!!input.aimVec && input.aimVec.x > 0);
  }
}

/**
 * Округлить вектор прицеливания до ближайшего из 4 кардинальных направлений.
 * Используется для `facing` (рендер спрайта игрока) и для случаев, когда
 * логике нужен именно Dir (например, поставить дверь в комнату).
 */
export function cardinalFromVec(v: { x: number; y: number }): Dir {
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'right' : 'left';
  return v.y > 0 ? 'down' : 'up';
}
