import { describe, it, expect } from 'vitest';
import { measureEyes } from '../src/tracker.js';

// 478点の顔ランドマークを、虹彩だけ意味のある値で作る
function face({ left, right, rl, rr }) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const put = (c, ring, p, r) => {
    pts[c] = { x: p.x, y: p.y };
    pts[ring[0]] = { x: p.x + r.x, y: p.y };
    pts[ring[2]] = { x: p.x - r.x, y: p.y };
    pts[ring[1]] = { x: p.x, y: p.y - r.y };
    pts[ring[3]] = { x: p.x, y: p.y + r.y };
  };
  put(468, [469, 470, 471, 472], left, rl);
  put(473, [474, 475, 476, 477], right, rr);
  return pts;
}

describe('measureEyes', () => {
  it('両目の虹彩中心の中点を返す', () => {
    const r = measureEyes(face({ left: { x: 0.4, y: 0.5 }, right: { x: 0.6, y: 0.4 }, rl: { x: 0.01, y: 0.018 }, rr: { x: 0.01, y: 0.018 } }), 1280, 720);
    expect(r.u).toBeCloseTo(0.5);
    expect(r.v).toBeCloseTo(0.45);
  });
  it('虹彩の直径は縮みにくい方(大きい方)を画像幅比で返す', () => {
    // 左目: 横 0.02*1280=25.6px / 縦 0.036*720=25.9px、右目は横向きで縮んでいる
    const r = measureEyes(face({ left: { x: 0.4, y: 0.5 }, right: { x: 0.6, y: 0.5 }, rl: { x: 0.01, y: 0.018 }, rr: { x: 0.004, y: 0.01 } }), 1280, 720);
    expect(r.iris * 1280).toBeCloseTo(0.036 * 720);
  });
});
