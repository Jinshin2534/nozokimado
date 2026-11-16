import { describe, it, expect } from 'vitest';
import { dancePose, LOOP_BEATS } from '../src/lib/dance.js';

const flat = (p) => Object.entries(p).flatMap(([k, v]) => [...v.rot.map((x, i) => [`${k}.rot${i}`, x]), ...(v.pos || []).map((x, i) => [`${k}.pos${i}`, x])]);

describe('dancePose', () => {
  it('どの拍でも数値が有限で、関節は無理な角度にならない(|角度|<2.3rad、腰の移動<8cm)', () => {
    for (let b = 0; b < LOOP_BEATS * 2; b += 0.05) {
      for (const [k, v] of flat(dancePose(b))) {
        expect(Number.isFinite(v), k).toBe(true);
        expect(Math.abs(v), `${k} @${b}`).toBeLessThan(k.includes('pos') ? 0.08 : 2.3);
      }
    }
  });
  it('32拍でループする', () => {
    for (const b of [0, 3.3, 11.7, 25.2]) {
      const a = flat(dancePose(b));
      const c = flat(dancePose(b + LOOP_BEATS));
      a.forEach(([k, v], i) => expect(c[i][1], k).toBeCloseTo(v, 6));
    }
  });
  it('振りの切り替わりで飛ばない(0.02拍ごとの変化が0.2rad未満)', () => {
    let prev = new Map(flat(dancePose(0)));
    for (let b = 0.02; b < LOOP_BEATS + 1; b += 0.02) {
      const cur = new Map(flat(dancePose(b)));
      for (const [k, v] of cur) {
        if (prev.has(k)) expect(Math.abs(v - prev.get(k)), `${k} @${b.toFixed(2)}`).toBeLessThan(0.2);
      }
      prev = cur;
    }
  });
  it('拍の頭で沈み、拍の真ん中で伸びる', () => {
    expect(dancePose(0).hips.pos[1]).toBeLessThan(dancePose(0.5).hips.pos[1]);
    expect(dancePose(3).leftLowerLeg.rot[0]).toBeGreaterThan(dancePose(3.5).leftLowerLeg.rot[0]);
  });
  it('片手ずつ突き上げる振りは、拍の大半で左右がはっきり上下に分かれる', () => {
    let split = 0, n = 0;
    for (let b = 16; b < 24; b += 0.05, n++) {
      const p = dancePose(b);
      if (Math.abs(p.leftUpperArm.rot[2] + p.rightUpperArm.rot[2]) > 1.2) split++;
    }
    expect(split / n).toBeGreaterThan(0.6);
  });
  it('8〜16拍目は両手が上がっている', () => {
    const p = dancePose(10);
    expect(p.leftUpperArm.rot[2]).toBeGreaterThan(0.5);
    expect(p.rightUpperArm.rot[2]).toBeLessThan(-0.5);
  });
});
