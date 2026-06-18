/**
 * rng.ts — генератор случайных чисел с поддержкой seed.
 *
 * Зачем не просто Math.random(): с фиксированным seed карта и спавн
 * становятся воспроизводимыми. Это бесценно для отладки («дай мне ту же
 * самую кривую генерацию») и для тестов (см. tests/). Вся игровая логика
 * получает один экземпляр Rng и использует только его — никаких прямых
 * вызовов Math.random() в ядре.
 */

export class Rng {
  private state: number;

  /** Без seed — случайный старт; с seed — детерминированная цепочка. */
  constructor(seed?: number) {
    // 0 — валидный seed, поэтому проверяем именно на undefined.
    this.state = (seed === undefined ? (Math.random() * 2 ** 32) >>> 0 : seed) >>> 0;
  }

  /** Следующее число в [0, 1). Алгоритм mulberry32 — быстрый и достаточный. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Случайное вещественное в [a, b). */
  float(a: number, b: number): number {
    return this.next() * (b - a) + a;
  }

  /** Случайное целое в [a, b] включительно. */
  int(a: number, b: number): number {
    return Math.floor(this.float(a, b + 1));
  }

  /** true с вероятностью p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Случайный элемент массива. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Перемешивание Фишера–Йейтса на месте. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
