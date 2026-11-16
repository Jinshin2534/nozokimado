import * as THREE from 'three';
import { windowFrustum, eyeFromCamera, cameraToScreen, cameraPosition, viewportOffset } from './lib/geometry.js';
import { OneEuro3 } from './lib/filter.js';
import { DEVICES, CUSTOM_ID, guessDevice, customDevice, physicalScreen } from './lib/devices.js';
import { createWorld, sampleModel, loadModelFile, loadMotionFile } from './scene.js';
import { createTracker } from './tracker.js';
import { saveFile, loadFile, clearFile, loadSettings, saveSettings } from './store.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;
const screenCss = () => ({ width: screen.width, height: screen.height });

const settings = loadSettings({
  mode: 'box',
  deviceId: null, // null = 自動
  customWidthCm: null,
  size: 1,
  turn: 0,
  debug: false,
  hasModel: false,
  dance: true,
  bpm: 120,
});

// ---- 描画 ----
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera();
camera.matrixAutoUpdate = true;
const world = createWorld(renderer);

// ---- 画面の物理サイズ ----
const view = { win: { width: 0.3, height: 0.2 }, offset: { x: 0, y: 0 }, cam: { x: 0, y: 0.1 }, device: null, defaultEye: null };

function currentDevice() {
  const sc = screenCss();
  if (settings.deviceId === CUSTOM_ID && settings.customWidthCm > 0) {
    // 入力された「今の向きの横幅」から 1cm あたりの px を出す
    return { ...customDevice(sc, sc.width / settings.customWidthCm, isTouch), label: '自分で入力' };
  }
  return DEVICES.find((d) => d.id === settings.deviceId) || guessDevice(sc, isTouch);
}

function measure() {
  const sc = screenCss();
  const device = currentDevice();
  const phys = physicalScreen(device, sc);
  const angle = isTouch ? screen.orientation?.angle ?? window.orientation ?? 0 : 0;
  view.device = device;
  view.win = { width: innerWidth / phys.pxPerM, height: innerHeight / phys.pxPerM };
  view.offset = isTouch
    ? { x: 0, y: 0 }
    : viewportOffset(sc, { screenX, screenY, outerWidth, outerHeight, innerWidth, innerHeight }, phys.pxPerM);
  view.cam = cameraPosition({ width: phys.width, height: phys.height }, device.camGapCm / 100, angle);
  view.defaultEye = { x: 0, y: 0, z: isTouch ? 0.32 : 0.55 };
  renderer.setSize(innerWidth, innerHeight, false);
  world.layout(view.win.width, view.win.height);
}

// ---- 目の位置 ----
const eye = { raw: null, smooth: null, lastSeen: -1, source: 'none' };
const filter = new OneEuro3({ minCutoff: 0.8, beta: 4, dCutoff: 1 });
let current = { x: 0, y: 0, z: 0.55 };

function eyeInViewport(p) {
  return { x: p.x - view.offset.x, y: p.y - view.offset.y, z: p.z };
}

let tracker = null;
const video = $('cam');

async function startTracking() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    showNotice('目を認識する準備をしています…');
    tracker = await createTracker();
    if (eye.source !== 'manual') eye.source = 'camera';
    hideNotice();
  } catch (e) {
    console.warn('[nozokimado] tracking', e);
    if (eye.source === 'manual') return;
    eye.source = 'pointer';
    showNotice('カメラを使えないので、マウスや指の位置を目の代わりにしています', 6000);
  }
}

function track(nowMs) {
  if (eye.source !== 'camera' || !tracker) return;
  const r = tracker.detect(video, nowMs);
  if (r === undefined) return;
  if (!r) return;
  const camEye = eyeFromCamera(r, { width: video.videoWidth, height: video.videoHeight }, view.device.hfov);
  if (!(camEye.z > 0.08 && camEye.z < 3)) return;
  const p = eyeInViewport(cameraToScreen(camEye, view.cam));
  eye.raw = p;
  eye.smooth = filter.filter(p, nowMs / 1000);
  eye.lastSeen = nowMs;
}

// カメラが無いときはポインタの位置を目の代わりにする(検証用にも使う)
window.addEventListener('pointermove', (e) => {
  if (eye.source !== 'pointer') return;
  const nx = e.clientX / innerWidth - 0.5;
  const ny = e.clientY / innerHeight - 0.5;
  eye.smooth = { x: nx * view.win.width * 1.2, y: -ny * view.win.height * 1.2, z: view.defaultEye.z };
  eye.lastSeen = performance.now();
});

// ---- お知らせ ----
let noticeTimer = 0;
function showNotice(text, ms = 0) {
  $('notice').textContent = text;
  $('notice').hidden = false;
  clearTimeout(noticeTimer);
  if (ms) noticeTimer = setTimeout(hideNotice, ms);
}
function hideNotice() {
  $('notice').hidden = true;
}

// ---- モデル / モーション ----
let motionAnim = null; // 読み込み済みの .vrma(新しい VRM にも付け直す)

function describeModel() {
  const m = world.model;
  if (!m) return;
  const motion = m.isVrm ? `（${m.motionName ? `モーション: ${m.motionName}` : settings.dance ? '組み込みダンス' : '待機'}）` : '';
  $('model-name').textContent = `表示中: ${m.name}${motion}`;
  $('unmotion').hidden = !m.motionName;
}

async function useFile(file, { restoring = false } = {}) {
  if (!file) return;
  if (/\.vrma$/i.test(file.name)) return useMotion(file, { restoring });
  if (!/\.(glb|gltf|vrm)$/i.test(file.name)) {
    showNotice('.glb / .gltf / .vrm / .vrma のファイルを選んでください', 4000);
    return;
  }
  showNotice(`${file.name} を読み込んでいます…`);
  try {
    const m = await loadModelFile(file);
    world.setModel(m);
    if (m.isVrm && motionAnim) m.setMotion(motionAnim.anim, motionAnim.name);
    hideNotice();
    settings.hasModel = true;
    saveSettings(settings);
    $('pick-first').hidden = true;
    describeModel();
    if (!restoring) saveFile(file, 'last');
  } catch (e) {
    console.warn('[nozokimado] load', e);
    showNotice(
      /\.gltf$/i.test(file.name)
        ? '読み込めませんでした。.gltf は画像などが別ファイルだと読めないので、.glb にまとめてください'
        : '読み込めませんでした。壊れているか、対応していない形式です',
      6000,
    );
  }
}

async function useMotion(file, { restoring = false } = {}) {
  try {
    const anim = await loadMotionFile(file);
    motionAnim = { anim, name: file.name };
    if (!restoring) saveFile(file, 'motion');
    if (world.model?.isVrm) {
      world.model.setMotion(anim, file.name);
      if (!restoring) showNotice(`${file.name} で踊ります`, 3000);
    } else if (!restoring) {
      showNotice('モーションを覚えました。VRM のモデルを読み込むと、そのモーションで踊ります', 5000);
    }
    describeModel();
  } catch (e) {
    console.warn('[nozokimado] motion', e);
    showNotice('モーションを読み込めませんでした（.vrma に対応しています）', 5000);
  }
}

async function dropMotion() {
  motionAnim = null;
  await clearFile('motion');
  world.model?.setMotion?.(null);
  describeModel();
}

function useSample() {
  world.setModel(sampleModel());
  describeModel();
}

// ---- 設定パネル ----
function fillDevices() {
  const sel = $('device');
  const auto = guessDevice(screenCss(), isTouch);
  const opts = [
    [`auto`, `自動（${auto.label}）`],
    ...DEVICES.map((d) => [d.id, d.label]),
    [CUSTOM_ID, '自分で入力'],
  ];
  sel.replaceChildren(...opts.map(([v, t]) => Object.assign(document.createElement('option'), { value: v, textContent: t })));
}

function syncPanel() {
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
  $('device').value = settings.deviceId || 'auto';
  $('custom-row').hidden = settings.deviceId !== CUSTOM_ID;
  $('custom-width').value = settings.customWidthCm ?? +(view.win.width * 100).toFixed(1);
  $('size').value = settings.size;
  $('turn').value = settings.turn;
  $('debug-toggle').checked = settings.debug;
  $('dance-toggle').checked = settings.dance;
  $('bpm').value = settings.bpm;
  $('bpm-value').textContent = settings.bpm;
}

function openPanel() {
  syncPanel();
  $('panel').hidden = false;
}
function closePanel() {
  $('panel').hidden = true;
}
function changed() {
  saveSettings(settings);
  syncPanel();
}

for (const b of document.querySelectorAll('[data-mode]')) {
  b.onclick = () => {
    settings.mode = b.dataset.mode;
    world.setMode(settings.mode);
    changed();
  };
}
$('device').onchange = (e) => {
  const v = e.target.value;
  settings.deviceId = v === 'auto' ? null : v;
  if (v === CUSTOM_ID && !settings.customWidthCm) settings.customWidthCm = +(view.win.width * 100).toFixed(1);
  measure();
  changed();
};
$('custom-width').onchange = (e) => {
  const v = Number(e.target.value);
  if (v > 0) settings.customWidthCm = v;
  measure();
  changed();
};
$('size').oninput = (e) => {
  settings.size = Number(e.target.value);
  world.setSize(settings.size);
  saveSettings(settings);
};
$('turn').oninput = (e) => {
  settings.turn = Number(e.target.value);
  world.setTurn(settings.turn);
  saveSettings(settings);
};
$('debug-toggle').onchange = (e) => {
  settings.debug = e.target.checked;
  $('debug').hidden = !settings.debug;
  saveSettings(settings);
};
$('dance-toggle').onchange = (e) => {
  settings.dance = e.target.checked;
  world.setDance(settings.dance, settings.bpm);
  saveSettings(settings);
  describeModel();
};
$('bpm').oninput = (e) => {
  settings.bpm = Number(e.target.value);
  $('bpm-value').textContent = settings.bpm;
  world.setDance(settings.dance, settings.bpm);
  saveSettings(settings);
};
$('unmotion').onclick = dropMotion;
$('pick').onclick = $('pick-first').onclick = () => $('file').click();
$('sample').onclick = async () => {
  await clearFile('last');
  await dropMotion();
  settings.hasModel = false;
  saveSettings(settings);
  useSample();
};
$('close').onclick = closePanel;
$('panel').addEventListener('click', (e) => {
  if (e.target === $('panel')) closePanel();
});
$('file').onchange = async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  closePanel();
  await useFile(f);
};

// 長押し / S キー
let pressTimer = 0;
let pressAt = null;
window.addEventListener('pointerdown', (e) => {
  goImmersive();
  if (!$('panel').hidden || e.target.closest('button,input,select,label')) return;
  pressAt = { x: e.clientX, y: e.clientY };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(openPanel, 650);
});
window.addEventListener('pointermove', (e) => {
  if (pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 12) clearTimeout(pressTimer);
});
for (const ev of ['pointerup', 'pointercancel']) {
  window.addEventListener(ev, () => {
    clearTimeout(pressTimer);
    pressAt = null;
  });
}
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input,select')) return;
  if (e.key === 's' || e.key === 'S') $('panel').hidden ? openPanel() : closePanel();
  else if (e.key === 'Escape') closePanel();
});

// ドラッグ＆ドロップ
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  $('drop').hidden = false;
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) $('drop').hidden = true;
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').hidden = true;
  useFile(e.dataTransfer.files?.[0]);
});

// 全画面・スリープ防止
let wakeLock = null;
async function goImmersive() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    }
  } catch {}
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

window.addEventListener('resize', measure);
screen.orientation?.addEventListener?.('change', measure);

// ---- デバッグ表示 ----
const pctx = $('preview').getContext('2d');
function drawDebug(fps) {
  if (!settings.debug) return;
  if (video.videoWidth) {
    pctx.save();
    pctx.scale(-1, 1); // 鏡のように見せる
    pctx.drawImage(video, -160, 0, 160, 120);
    pctx.restore();
  }
  const e = current;
  const cm = (v) => (v * 100).toFixed(1).padStart(6);
  $('readout').textContent =
    `目  x${cm(e.x)}  y${cm(e.y)}  距離${cm(e.z)} cm\n` +
    `窓  ${(view.win.width * 100).toFixed(1)}×${(view.win.height * 100).toFixed(1)} cm (${view.device.label})\n` +
    `追跡 ${eye.source === 'camera' ? (performance.now() - eye.lastSeen < 500 ? 'OK' : '見失い') : eye.source}  ${fps.toFixed(0)} fps`;
}

// ---- ループ ----
const eyeWorld = new THREE.Vector3();
let lastT = performance.now();
let fpsAvg = 60;
let lostShown = false;

function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.05;
  track(now);

  const fresh = eye.smooth && (eye.lastSeen === Infinity || now - eye.lastSeen < 600);
  const target = fresh ? eye.smooth : view.defaultEye;
  // 見失ったときはゆっくり正面に戻す。見えているときはフィルタ済みの値をそのまま使う
  const k = fresh ? 1 : 1 - Math.exp(-dt * 1.5);
  current = {
    x: current.x + (target.x - current.x) * k,
    y: current.y + (target.y - current.y) * k,
    z: current.z + (target.z - current.z) * k,
  };
  if (eye.source === 'camera' && tracker) {
    if (!fresh && !lostShown && eye.lastSeen > 0) {
      showNotice('目が見えなくなりました');
      lostShown = true;
    } else if (fresh && lostShown) {
      hideNotice();
      lostShown = false;
    }
  }

  const near = 0.01;
  const f = windowFrustum(view.win, current, near);
  camera.position.set(current.x, current.y, current.z);
  camera.quaternion.identity();
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, near, 20);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  eyeWorld.set(current.x, current.y, current.z);
  world.update(dt, now / 1000, eyeWorld);
  renderer.render(world.scene, camera);
  drawDebug(fpsAvg);
  requestAnimationFrame(frame);
}

// ---- 起動 ----
(async () => {
  fillDevices();
  measure();
  world.setMode(settings.mode);
  world.setSize(settings.size);
  world.setTurn(settings.turn);
  world.setDance(settings.dance, settings.bpm);
  $('debug').hidden = !settings.debug;
  useSample();
  current = { ...view.defaultEye };
  requestAnimationFrame(frame);

  const savedMotion = await loadFile('motion');
  if (savedMotion?.blob) await useMotion(new File([savedMotion.blob], savedMotion.name), { restoring: true });
  const saved = await loadFile('last');
  if (saved?.blob) await useFile(new File([saved.blob], saved.name), { restoring: true });
  $('pick-first').hidden = settings.hasModel;
  if (!settings.hasModel) setTimeout(() => ($('pick-first').hidden = true), 12000);

  showNotice('片目をつぶると、もっと立体的に見えます', 5000);
  startTracking();
})();

// ヘッドレス検証用
window.__app = {
  settings,
  view,
  world,
  get eye() {
    return current;
  },
  // 目の位置を直接与える(画面中心基準、m)。source を 'manual' にしてカメラを無視する
  setEye(p) {
    eye.source = 'manual';
    eye.smooth = p;
    eye.lastSeen = Infinity; // 手で与えた位置は見失わない
    current = { ...p };
    hideNotice();
  },
  useFile,
  openPanel,
  closePanel,
};
