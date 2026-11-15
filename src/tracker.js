// カメラ映像から目(両目の虹彩の中点)と虹彩の大きさを取る。MediaPipe Face Landmarker。
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// 虹彩ランドマーク: 468=左虹彩中心, 469-472=その周囲 / 473=右虹彩中心, 474-477=周囲
const IRIS = [
  { c: 468, ring: [469, 470, 471, 472] },
  { c: 473, ring: [474, 475, 476, 477] },
];

export async function createTracker() {
  const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks(WASM);
  const make = (delegate) =>
    FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  let lm;
  try {
    lm = await make('GPU');
  } catch {
    lm = await make('CPU');
  }
  let lastTime = -1;
  return {
    // 新しいフレームがあれば {u, v, iris} (正規化)、顔が無ければ null、フレームが同じなら undefined
    detect(video, nowMs) {
      if (video.readyState < 2 || video.currentTime === lastTime) return undefined;
      lastTime = video.currentTime;
      const res = lm.detectForVideo(video, nowMs);
      const pts = res.faceLandmarks?.[0];
      if (!pts || pts.length < 478) return null;
      return measureEyes(pts, video.videoWidth, video.videoHeight);
    },
  };
}

// 虹彩の直径は、首を振ったとき縮みにくい方(左右の目のうち大きい方、縦横のうち大きい方)を使う
export function measureEyes(pts, w, h) {
  let u = 0, v = 0, best = 0;
  for (const { c, ring } of IRIS) {
    u += pts[c].x / 2;
    v += pts[c].y / 2;
    const dx = Math.hypot((pts[ring[0]].x - pts[ring[2]].x) * w, (pts[ring[0]].y - pts[ring[2]].y) * h);
    const dy = Math.hypot((pts[ring[1]].x - pts[ring[3]].x) * w, (pts[ring[1]].y - pts[ring[3]].y) * h);
    best = Math.max(best, dx, dy);
  }
  return { u, v, iris: best / w };
}
