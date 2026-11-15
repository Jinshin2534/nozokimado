import { describe, it, expect } from 'vitest';
import { fitModel } from '../src/lib/fit.js';

const space = { width: 0.3, height: 0.2, depth: 0.3 };

describe('fitModel', () => {
  it('高さが空間の8割になるよう拡大し、底を y=0 に置く', () => {
    const r = fitModel({ min: { x: -0.5, y: 0, z: -0.5 }, max: { x: 0.5, y: 2, z: 0.5 } }, space);
    expect(r.scale).toBeCloseTo(0.08);
    expect(r.offset.y).toBeCloseTo(0);
  });
  it('横に長いモデルは幅で決まり、中心を原点に寄せる', () => {
    const r = fitModel({ min: { x: 10, y: 5, z: 0 }, max: { x: 14, y: 6, z: 1 } }, space);
    expect(r.scale).toBeCloseTo(0.06);
    expect(r.offset.x).toBeCloseTo(-12 * 0.06);
    expect(r.offset.y).toBeCloseTo(-5 * 0.06);
  });
  it('倍率をかけられる', () => {
    const a = fitModel({ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, space, 1);
    const b = fitModel({ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, space, 0.5);
    expect(b.scale).toBeCloseTo(a.scale / 2);
  });
  it('大きさ0のモデルは何もしない', () => {
    expect(fitModel({ min: { x: 1, y: 1, z: 1 }, max: { x: 1, y: 1, z: 1 } }, space).scale).toBe(1);
  });
});
