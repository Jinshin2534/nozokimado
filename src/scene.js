// 窓の向こうの空間(箱庭型 / 溶け込む型)とモデルの置き場所。単位はメートル、画面が z=0。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { fitModel } from './lib/fit.js';

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9edf3';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#aab4c3';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x50586a, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.002;
  scene.add(hemi, sun, sun.target);

  const room = new THREE.Group(); // 箱庭の壁
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  const stage = new THREE.Group(); // モデルを置く台(位置だけ)
  const turn = new THREE.Group(); // ユーザーの「向き」
  stage.add(turn);
  scene.add(room, shadowFloor, stage);

  const tex = gridTexture();
  let dims = null;
  let mode = 'box';
  let model = null; // { object, update(dt, t, eye), box }
  let size = 1;

  function buildRoom(W, H, D) {
    room.clear();
    const mat = (rx, ry) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(rx, ry);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
    };
    const cell = Math.max(W, H) / 10; // 1マスの大きさ
    const wall = (w, h, rx, ry, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(rx, ry));
      m.position.set(...pos);
      m.rotation.set(...rot);
      m.receiveShadow = true;
      room.add(m);
    };
    wall(W, H, W / cell, H / cell, [0, 0, -D], [0, 0, 0]); // 奥
    wall(W, D, W / cell, D / cell, [0, -H / 2, -D / 2], [-Math.PI / 2, 0, 0]); // 床
    wall(W, D, W / cell, D / cell, [0, H / 2, -D / 2], [Math.PI / 2, 0, 0]); // 天井
    wall(D, H, D / cell, H / cell, [-W / 2, 0, -D / 2], [0, Math.PI / 2, 0]); // 左
    wall(D, H, D / cell, H / cell, [W / 2, 0, -D / 2], [0, -Math.PI / 2, 0]); // 右
  }

  function layout(W, H) {
    const D = Math.min(W, H) * 1.1;
    dims = { W, H, D };
    buildRoom(W, H, D);
    applyMode();
  }

  function applyMode() {
    if (!dims) return;
    const { W, H, D } = dims;
    const box = mode === 'box';
    room.visible = box;
    shadowFloor.visible = !box;
    scene.background = new THREE.Color(box ? 0x202530 : 0x000000);
    hemi.intensity = box ? 1.1 : 0.7;
    hemi.groundColor.set(box ? 0x9aa3b5 : 0x50586a); // 箱庭の天井が真っ暗にならないように
    const floorY = box ? -H / 2 : -H * 0.36;
    const z = box ? -D * 0.5 : -D * 0.12;
    stage.position.set(0, floorY, z);
    shadowFloor.position.set(0, floorY + 0.0005, z);
    shadowFloor.scale.set(W * 1.5, D * 1.2, 1);
    sun.position.set(W * 0.25, H * 1.2, z + D * 0.6);
    sun.target.position.set(0, floorY, z);
    const sc = sun.shadow.camera;
    const r = Math.max(W, D);
    Object.assign(sc, { left: -r, right: r, top: r, bottom: -r, near: 0.01, far: H * 4 + D * 2 });
    sc.updateProjectionMatrix();
    refit();
  }

  function space() {
    const { W, H, D } = dims;
    return mode === 'box' ? { width: W * 0.9, height: H * 0.85, depth: D * 0.8 } : { width: W * 0.9, height: H * 0.8, depth: D * 0.8 };
  }

  function refit() {
    if (!model || !dims) return;
    const fit = fitModel(model.box, space(), size);
    model.object.scale.setScalar(fit.scale);
    model.object.position.set(fit.offset.x, fit.offset.y, fit.offset.z);
    placed();
  }

  // 置き方が変わったら、揺れもの(髪など)の基準をその位置で取り直す
  function placed() {
    if (!model) return;
    scene.updateMatrixWorld(true);
    model.onPlaced?.();
  }

  function setModel(m) {
    if (model) {
      turn.remove(model.object);
      model.dispose?.();
    }
    model = m;
    model.object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // 非対称な視錐台でも欠けないように
      }
    });
    turn.add(model.object);
    refit();
  }

  return {
    scene,
    layout,
    setMode(m) {
      mode = m;
      applyMode();
    },
    setSize(s) {
      size = s;
      refit();
    },
    setTurn(deg) {
      turn.rotation.y = (deg * Math.PI) / 180;
      placed();
    },
    setModel,
    get model() {
      return model;
    },
    update(dt, t, eyeWorld) {
      model?.update?.(dt, t, eyeWorld);
    },
  };
}

// ---- サンプル(自作) ----
export function sampleModel() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.18, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a4256, roughness: 0.6, metalness: 0.2 }),
  );
  base.position.y = 0.09;
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.32, 0.11, 200, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xff7a59, roughness: 0.25, metalness: 0.1, clearcoat: 0.8 }),
  );
  knot.position.y = 0.85;
  const orbit = new THREE.Group();
  orbit.position.y = 0.85;
  const colors = [0x5ac8fa, 0xffd60a, 0x30d158];
  colors.forEach((c, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
    const a = (i / colors.length) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.62, Math.sin(a * 2) * 0.12, Math.sin(a) * 0.62);
    orbit.add(s);
  });
  g.add(base, knot, orbit);
  const box = new THREE.Box3(new THREE.Vector3(-0.7, 0, -0.7), new THREE.Vector3(0.7, 1.4, 0.7));
  return {
    name: 'サンプル',
    object: g,
    box,
    update(dt, t) {
      knot.rotation.y = t * 0.4;
      knot.position.y = 0.85 + Math.sin(t * 1.3) * 0.04;
      orbit.rotation.y = -t * 0.6;
    },
  };
}

// ---- 読み込み(.glb / .gltf / .vrm) ----
export async function loadModelFile(file) {
  const buf = await file.arrayBuffer();
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await new Promise((resolve, reject) => loader.parse(buf, '', resolve, reject));
  const vrm = gltf.userData.vrm;
  const object = vrm ? vrm.scene : gltf.scene;
  const lookTarget = new THREE.Object3D();
  let mixer = null;
  let blinkAt = 2;

  if (vrm) {
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons?.(vrm.scene);
    VRMUtils.rotateVRM0(vrm); // VRM0.x は -z 向きなので正面(+z)へ
    const h = vrm.humanoid;
    // Tポーズのままだと不自然なので腕を下ろす
    h.getNormalizedBoneNode('leftUpperArm')?.rotation.set(0, 0, -1.2);
    h.getNormalizedBoneNode('rightUpperArm')?.rotation.set(0, 0, 1.2);
    h.getNormalizedBoneNode('leftLowerArm')?.rotation.set(0, 0, -0.15);
    h.getNormalizedBoneNode('rightLowerArm')?.rotation.set(0, 0, 0.15);
    vrm.update(0);
    if (vrm.lookAt) vrm.lookAt.target = lookTarget; // 見ている人と目を合わせる
  } else if (gltf.animations?.length) {
    mixer = new THREE.AnimationMixer(object);
    mixer.clipAction(gltf.animations[0]).play();
  }
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);

  return {
    name: file.name,
    object,
    box,
    isVrm: !!vrm,
    vrm,
    update(dt, t, eyeWorld) {
      mixer?.update(dt);
      if (vrm) {
        if (eyeWorld) lookTarget.position.copy(eyeWorld);
        const chest = vrm.humanoid.getNormalizedBoneNode('chest') || vrm.humanoid.getNormalizedBoneNode('spine');
        if (chest) chest.rotation.x = Math.sin(t * 1.6) * 0.015; // 呼吸
        const em = vrm.expressionManager;
        if (em) {
          const since = t - blinkAt;
          em.setValue('blink', since > 0 && since < 0.15 ? Math.sin((since / 0.15) * Math.PI) : 0);
          if (since > 0.15) blinkAt = t + 2 + Math.random() * 3;
        }
        vrm.update(dt);
      }
    },
    onPlaced() {
      if (!vrm?.springBoneManager) return;
      vrm.springBoneManager.setInitState();
      vrm.springBoneManager.reset();
    },
    dispose() {
      if (vrm) VRMUtils.deepDispose(vrm.scene);
    },
  };
}
