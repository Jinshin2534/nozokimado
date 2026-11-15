import { describe, it, expect } from 'vitest';
import { windowFrustum, focalFromFov, distanceFromIris, eyeFromCamera, cameraToScreen, cameraPosition, viewportOffset, IRIS_DIAMETER_M } from '../src/lib/geometry.js';

describe('windowFrustum', () => {
  const win = { width: 0.3, height: 0.2 };
  it('正面なら左右上下対称', () => {
    const f = windowFrustum(win, { x: 0, y: 0, z: 0.5 }, 0.05);
    expect(f.left).toBeCloseTo(-0.015);
    expect(f.right).toBeCloseTo(0.015);
    expect(f.top).toBeCloseTo(0.01);
    expect(f.bottom).toBeCloseTo(-0.01);
  });
  it('右に動くと視錐台は左に偏る(窓の左側が広く見える)', () => {
    const f = windowFrustum(win, { x: 0.1, y: 0, z: 0.5 }, 0.05);
    expect(f.right).toBeCloseTo((0.15 - 0.1) * 0.1);
    expect(f.left).toBeCloseTo((-0.15 - 0.1) * 0.1);
    expect(-f.left).toBeGreaterThan(f.right);
  });
  it('画面の四隅は距離や位置によらず視錐台の四隅に一致する', () => {
    for (const eye of [{ x: 0.2, y: -0.1, z: 0.3 }, { x: -0.05, y: 0.2, z: 0.9 }]) {
      const near = 0.01;
      const f = windowFrustum(win, eye, near);
      // 画面右上(0.15,0.1,0)へ向かう光線は near 面で (right, top) を通る
      const t = near / eye.z;
      expect(eye.x + (0.15 - eye.x) * t - eye.x).toBeCloseTo(f.right);
      expect(eye.y + (0.1 - eye.y) * t - eye.y).toBeCloseTo(f.top);
    }
  });
});

describe('カメラ → 目の位置', () => {
  it('画角60°・幅1280pxの焦点距離', () => {
    expect(focalFromFov(1280, 60)).toBeCloseTo(640 / Math.tan(Math.PI / 6));
  });
  it('虹彩の大きさが半分なら距離は倍', () => {
    const f = 1000;
    expect(distanceFromIris(23.4, f)).toBeCloseTo(0.5);
    expect(distanceFromIris(11.7, f)).toBeCloseTo(1.0);
    expect(distanceFromIris(0, f)).toBeNaN();
  });
  it('画像の中央に写れば x=y=0、距離は虹彩から', () => {
    const image = { width: 1280, height: 720 };
    const f = focalFromFov(1280, 60);
    const irisPx = (f * IRIS_DIAMETER_M) / 0.5; // 50cm で写る大きさ
    const e = eyeFromCamera({ u: 0.5, v: 0.5, iris: irisPx / 1280 }, image, 60);
    expect(e.x).toBeCloseTo(0);
    expect(e.y).toBeCloseTo(0);
    expect(e.z).toBeCloseTo(0.5);
  });
  it('生画像の左に写る = 見る人は右(x>0)、上に写る = 上(y>0)', () => {
    const image = { width: 1280, height: 720 };
    const e = eyeFromCamera({ u: 0.25, v: 0.25, iris: 0.03 }, image, 60);
    expect(e.x).toBeGreaterThan(0);
    expect(e.y).toBeGreaterThan(0);
  });
  it('カメラの位置を足して画面中心基準にする', () => {
    expect(cameraToScreen({ x: 0.01, y: -0.02, z: 0.5 }, { x: 0, y: 0.1 })).toEqual({ x: 0.01, y: 0.08, z: 0.5 });
  });
});

describe('cameraPosition (端末の向き)', () => {
  const s = { width: 0.3, height: 0.2 };
  it('通常は上辺の中央の少し上', () => expect(cameraPosition(s, 0.01, 0)).toEqual({ x: 0, y: 0.11 }));
  it('90°で左、270°で右、180°で下', () => {
    expect(cameraPosition(s, 0.01, 90)).toEqual({ x: -0.16, y: 0 });
    expect(cameraPosition(s, 0.01, 270)).toEqual({ x: 0.16, y: 0 });
    expect(cameraPosition(s, 0.01, 180)).toEqual({ x: 0, y: -0.11 });
    expect(cameraPosition(s, 0.01, -90)).toEqual({ x: 0.16, y: 0 });
  });
});

describe('viewportOffset', () => {
  const screenCss = { width: 1470, height: 956 };
  it('全画面ならずれ0', () => {
    const o = viewportOffset(screenCss, { screenX: 0, screenY: 0, outerWidth: 1470, outerHeight: 956, innerWidth: 1470, innerHeight: 956 }, 5000);
    expect(o.x).toBeCloseTo(0);
    expect(o.y).toBeCloseTo(0);
  });
  it('ツールバー80pxぶん表示領域は下にずれる(y<0)', () => {
    const o = viewportOffset(screenCss, { screenX: 0, screenY: 0, outerWidth: 1470, outerHeight: 956, innerWidth: 1470, innerHeight: 876 }, 5000);
    expect(o.x).toBeCloseTo(0);
    expect(o.y).toBeCloseTo(-40 / 5000);
  });
  it('右半分に置いたウィンドウは右にずれる', () => {
    const o = viewportOffset(screenCss, { screenX: 735, screenY: 0, outerWidth: 735, outerHeight: 956, innerWidth: 735, innerHeight: 956 }, 5000);
    expect(o.x).toBeCloseTo(367.5 / 5000);
  });
});
