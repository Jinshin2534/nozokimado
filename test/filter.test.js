import { describe, it, expect } from 'vitest';
import { OneEuro, OneEuro3 } from '../src/lib/filter.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('OneEuro', () => {
  it('最初の値はそのまま返す', () => {
    expect(new OneEuro().filter(3, 0)).toBe(3);
  });
  it('止まっているときの揺れを大きく減らす', () => {
    const rng = seeded(7);
    const f = new OneEuro({ minCutoff: 1, beta: 0.02 });
    let rawVar = 0, outVar = 0;
    for (let i = 0; i < 600; i++) {
      const noise = (rng() - 0.5) * 0.01;
      const out = f.filter(noise, i / 30);
      if (i > 60) { rawVar += noise * noise; outVar += out * out; }
    }
    expect(outVar).toBeLessThan(rawVar * 0.3);
  });
  it('速く動いたときは追いつく(遅れが小さい)', () => {
    const f = new OneEuro({ minCutoff: 1, beta: 2 });
    let out = 0;
    for (let i = 0; i <= 15; i++) out = f.filter(i < 5 ? 0 : 0.2, i / 30);
    expect(out).toBeGreaterThan(0.17);
  });
  it('時刻が進まない呼び出しは前の値を返す', () => {
    const f = new OneEuro();
    f.filter(1, 0);
    expect(f.filter(5, 0)).toBe(1);
  });
  it('3軸版はそれぞれ独立', () => {
    const f = new OneEuro3();
    expect(f.filter({ x: 1, y: 2, z: 3 }, 0)).toEqual({ x: 1, y: 2, z: 3 });
  });
});
