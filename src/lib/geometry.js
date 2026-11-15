// 画面を「窓」とみなす幾何(単位はすべてメートル)。
// 座標系: 画面(ビューポート)の中心が原点、x=右、y=上、z=画面から見る人へ向かう向き。

export const IRIS_DIAMETER_M = 0.0117; // 大人の虹彩の直径はほぼ一定(約11.7mm)

// 目の位置から、画面の四辺を通る非対称な視錐台(near 面での left/right/top/bottom)を求める
export function windowFrustum(win, eye, near) {
  const z = Math.max(eye.z, 1e-3);
  const k = near / z;
  return {
    left: (-win.width / 2 - eye.x) * k,
    right: (win.width / 2 - eye.x) * k,
    top: (win.height / 2 - eye.y) * k,
    bottom: (-win.height / 2 - eye.y) * k,
  };
}

// 水平画角(度)と画像幅(px)から焦点距離(px)
export function focalFromFov(imageWidthPx, hfovDeg) {
  return imageWidthPx / 2 / Math.tan(((hfovDeg * Math.PI) / 180) / 2);
}

// 写った虹彩の直径(px)からカメラまでの距離(m)
export function distanceFromIris(irisPx, focalPx) {
  if (!(irisPx > 0)) return NaN;
  return (focalPx * IRIS_DIAMETER_M) / irisPx;
}

// カメラ画像上の目の位置(正規化 u,v: 0..1、左上原点、鏡像でない生画像)と
// 虹彩の直径(画像幅に対する割合)から、カメラを原点にした目の3D位置(m)を出す。
// 生画像では見る人の右側が画像の左に写るので x は反転する。
export function eyeFromCamera({ u, v, iris }, image, hfovDeg) {
  const f = focalFromFov(image.width, hfovDeg);
  const z = distanceFromIris(iris * image.width, f);
  return {
    x: -((u - 0.5) * image.width * z) / f,
    y: -((v - 0.5) * image.height * z) / f,
    z,
  };
}

// カメラ基準の位置 → 画面中心基準の位置。cam はカメラの位置(画面中心基準、m)
export function cameraToScreen(p, cam) {
  return { x: p.x + cam.x, y: p.y + cam.y, z: p.z };
}

// 端末を回したとき(screen.orientation.angle)、本来「上辺の中央」にあるカメラが
// どこへ来るか。width/height は回した後の画面の物理サイズ(m)、gap は上辺からの距離(m)。
export function cameraPosition(screenSize, gap, angle) {
  const a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  if (a === 90) return { x: -screenSize.width / 2 - gap, y: 0 }; // 本体の上が左へ
  if (a === 270) return { x: screenSize.width / 2 + gap, y: 0 }; // 本体の上が右へ
  if (a === 180) return { x: 0, y: -screenSize.height / 2 - gap };
  return { x: 0, y: screenSize.height / 2 + gap };
}

// ブラウザの表示領域(ビューポート)の中心が、画面の中心からどれだけずれているか(m)。
// ブラウザのツールバーは上側にある前提。全画面ならほぼ 0。
export function viewportOffset(screenCss, win, pxPerM) {
  const side = Math.max(0, (win.outerWidth - win.innerWidth) / 2);
  const left = win.screenX + side;
  const top = win.screenY + Math.max(0, win.outerHeight - win.innerHeight - side);
  const cx = left + win.innerWidth / 2;
  const cy = top + win.innerHeight / 2;
  return {
    x: (cx - screenCss.width / 2) / pxPerM,
    y: -(cy - screenCss.height / 2) / pxPerM,
  };
}
