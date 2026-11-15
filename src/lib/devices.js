// 機種プリセット。画面の物理サイズ(縦持ち/通常の向きでの cm)、既定の表示解像度(CSS px)、
// 前面カメラの水平画角、カメラが表示領域の上辺からどれだけ上にあるか(cm)。
// 物理サイズは対角インチと解像度の縦横比から計算した値。

function sizeFromDiagonal(inch, pxW, pxH) {
  const d = inch * 2.54;
  const a = pxW / pxH;
  const h = d / Math.sqrt(1 + a * a);
  return { widthCm: +(h * a).toFixed(2), heightCm: +h.toFixed(2) };
}

export const DEVICES = [
  { id: 'mba13', label: 'MacBook Air 13インチ', ...sizeFromDiagonal(13.6, 2560, 1664), css: [1470, 956], hfov: 65, camGapCm: 0.4, desktop: true },
  { id: 'mba15', label: 'MacBook Air 15インチ', ...sizeFromDiagonal(15.3, 2880, 1864), css: [1710, 1112], hfov: 65, camGapCm: 0.4, desktop: true },
  { id: 'mbp14', label: 'MacBook Pro 14インチ', ...sizeFromDiagonal(14.2, 3024, 1964), css: [1512, 982], hfov: 65, camGapCm: 0.4, desktop: true },
  { id: 'mbp16', label: 'MacBook Pro 16インチ', ...sizeFromDiagonal(16.2, 3456, 2234), css: [1728, 1117], hfov: 65, camGapCm: 0.4, desktop: true },
  { id: 'imac24', label: 'iMac 24インチ', ...sizeFromDiagonal(23.5, 4480, 2520), css: [2240, 1260], hfov: 65, camGapCm: 1.5, desktop: true },
  { id: 'iphone', label: 'iPhone (6.1インチ)', ...sizeFromDiagonal(6.1, 1179, 2556), css: [393, 852], hfov: 68, camGapCm: -0.5, desktop: false },
  { id: 'iphonemax', label: 'iPhone Pro Max / Plus (6.7〜6.9インチ)', ...sizeFromDiagonal(6.8, 1290, 2796), css: [430, 932], hfov: 68, camGapCm: -0.5, desktop: false },
  { id: 'ipad11', label: 'iPad (11インチ)', ...sizeFromDiagonal(10.9, 1640, 2360), css: [820, 1180], hfov: 75, camGapCm: 1.0, desktop: false },
];

export const CUSTOM_ID = 'custom';

// 画面の CSS サイズからプリセットを推測する(縦横どちらの向きでも可、±8px)。
// 見つからなければ、デスクトップ/モバイルの典型的な画素密度で「自作」プリセットを作る。
export function guessDevice(screenCss, isTouch) {
  const [w, h] = [screenCss.width, screenCss.height];
  for (const d of DEVICES) {
    const [cw, ch] = d.css;
    const near = (a, b) => Math.abs(a - b) <= 8;
    if ((near(w, cw) && near(h, ch)) || (near(w, ch) && near(h, cw))) return d;
  }
  return customDevice(screenCss, isTouch ? 60 : 48, isTouch);
}

// 1cm あたりの CSS px から作る自作プリセット(通常の向きの寸法に正規化)
export function customDevice(screenCss, pxPerCm, isTouch) {
  const long = +(Math.max(screenCss.width, screenCss.height) / pxPerCm).toFixed(2);
  const short = +(Math.min(screenCss.width, screenCss.height) / pxPerCm).toFixed(2);
  // 通常の向き: パソコンは横長、タッチ端末は縦長
  return {
    id: CUSTOM_ID,
    label: '自動推測',
    widthCm: isTouch ? short : long,
    heightCm: isTouch ? long : short,
    css: [screenCss.width, screenCss.height],
    hfov: isTouch ? 68 : 62,
    camGapCm: isTouch ? -0.5 : 0.6,
    desktop: !isTouch,
  };
}

// 今の向きでの物理サイズ(m)と 1m あたりの CSS px
export function physicalScreen(device, screenCss) {
  const landscapeNow = screenCss.width > screenCss.height;
  const landscapeDev = device.widthCm > device.heightCm;
  const [wCm, hCm] = landscapeNow === landscapeDev ? [device.widthCm, device.heightCm] : [device.heightCm, device.widthCm];
  return { width: wCm / 100, height: hCm / 100, pxPerM: screenCss.width / (wCm / 100) };
}
