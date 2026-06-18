import { describe, it, expect } from 'bun:test';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('детерминирован: одинаковый seed → одинаковая последовательность', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('разные seed дают разные последовательности', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() всегда в [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(a, b) держится в границах включительно', () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('shuffle сохраняет все элементы', () => {
    const r = new Rng(42);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = r.shuffle([...arr]);
    expect([...shuffled].sort()).toEqual(arr);
  });

  it('авто-seed не вызывает Math.random()', () => {
    const math = Math as Math & { random: () => number };
    const original = math.random;
    math.random = () => { throw new Error('Math.random вызван'); };
    try {
      const r = new Rng();
      expect(r.next()).toBeGreaterThanOrEqual(0);
      expect(r.next()).toBeLessThan(1);
    } finally {
      math.random = original;
    }
  });

  it('pick явно ругается на пустой массив', () => {
    expect(() => new Rng(1).pick([])).toThrow('пустой массив');
  });
});
