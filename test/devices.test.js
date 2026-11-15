import { describe, it, expect } from 'vitest';
import { DEVICES, guessDevice, customDevice, physicalScreen, CUSTOM_ID } from '../src/lib/devices.js';

describe('devices', () => {
  it('MacBook Air 13 の画面は約29×19cm', () => {
    const d = DEVICES.find((d) => d.id === 'mba13');
    expect(d.widthCm).toBeCloseTo(28.96, 1);
    expect(d.heightCm).toBeCloseTo(18.83, 1);
  });
  it('CSS サイズで機種を当てる(縦横どちらでも)', () => {
    expect(guessDevice({ width: 1470, height: 956 }, false).id).toBe('mba13');
    expect(guessDevice({ width: 852, height: 393 }, true).id).toBe('iphone');
    expect(guessDevice({ width: 1512, height: 982 }, false).id).toBe('mbp14');
  });
  it('知らない画面は画素密度から推測(パソコンは横長、タッチ端末は縦長)', () => {
    const d = guessDevice({ width: 1920, height: 1080 }, false);
    expect(d.id).toBe(CUSTOM_ID);
    expect(d.widthCm).toBeCloseTo(40);
    expect(d.heightCm).toBeCloseTo(22.5);
    const t = customDevice({ width: 900, height: 600 }, 60, true);
    expect(t.widthCm).toBeCloseTo(10);
    expect(t.heightCm).toBeCloseTo(15);
  });
  it('今の向きに合わせて縦横を入れ替える', () => {
    const iphone = DEVICES.find((d) => d.id === 'iphone');
    const portrait = physicalScreen(iphone, { width: 393, height: 852 });
    const land = physicalScreen(iphone, { width: 852, height: 393 });
    expect(portrait.width).toBeLessThan(portrait.height);
    expect(land.width).toBeCloseTo(portrait.height);
    expect(land.pxPerM).toBeCloseTo(852 / portrait.height);
  });
  it('すべてのプリセットの縦横比は CSS 解像度の縦横比と一致する', () => {
    for (const d of DEVICES) {
      const [cw, ch] = d.css;
      expect(d.widthCm / d.heightCm).toBeCloseTo(cw / ch, 1);
    }
  });
});
