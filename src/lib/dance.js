// 組み込みダンス(純粋関数)。拍 b(=経過秒×BPM/60) → VRM の正規化ボーンの回転(ラジアン)と腰の移動(m)。
// 8拍ずつ4つの振りを回す32拍のループ。振りの切り替わりは前後1拍で混ぜてつなぐ。
// 向き: モデルは +z(見る人の方)を向く。左腕は +x 側にあり、rotation.z が負で下がる・正で上がる。

const TAU = Math.PI * 2;
export const LOOP_BEATS = 32;

const smooth = (x) => x * x * (3 - 2 * x);

// 全身の共通の揺れ(どの振りでも同じ)
function groove(b) {
  const bounce = (1 + Math.cos(TAU * b)) / 2; // 拍の頭で沈み、拍の真ん中で伸びる(0..1)
  const sway = Math.sin(Math.PI * b); // 2拍で左右1往復
  return {
    hips: { pos: [sway * 0.035, -bounce * 0.035, 0], rot: [0, sway * 0.12, -sway * 0.05] },
    spine: { rot: [bounce * 0.05, 0, sway * 0.06] },
    chest: { rot: [0, -sway * 0.08, 0] },
    neck: { rot: [bounce * 0.06, 0, 0] },
    head: { rot: [0, 0, -sway * 0.1] },
    leftUpperLeg: { rot: [-bounce * 0.25, 0, 0] },
    rightUpperLeg: { rot: [-bounce * 0.25, 0, 0] },
    leftLowerLeg: { rot: [bounce * 0.5, 0, 0] },
    rightLowerLeg: { rot: [bounce * 0.5, 0, 0] },
    leftFoot: { rot: [-bounce * 0.25, 0, 0] },
    rightFoot: { rot: [-bounce * 0.25, 0, 0] },
  };
}

// 腕の振り(8拍ごと)
const MOVES = [
  // 0: 腕を下ろしたままリズムに合わせて前後に振る
  (b) => {
    const s = Math.sin(Math.PI * b);
    return {
      leftUpperArm: { rot: [s * 0.35, 0, -1.15] },
      rightUpperArm: { rot: [-s * 0.35, 0, 1.15] },
      leftLowerArm: { rot: [0, -0.3, 0] },
      rightLowerArm: { rot: [0, 0.3, 0] },
    };
  },
  // 1: 両手を上げて左右に振る
  (b) => {
    const s = Math.sin(Math.PI * b);
    return {
      leftUpperArm: { rot: [0, 0, 1.0 + s * 0.25] },
      rightUpperArm: { rot: [0, 0, -1.0 + s * 0.25] },
      leftLowerArm: { rot: [0, 0, 0.4 + s * 0.2] },
      rightLowerArm: { rot: [0, 0, -0.4 + s * 0.2] },
    };
  },
  // 2: 1拍ごとに片手ずつ突き上げる(上下の端で止まり、入れ替わりは素早く)
  (b) => {
    const up = 0.5 + 0.5 * Math.tanh(2.5 * Math.sin(Math.PI * b)) / Math.tanh(2.5); // 1=左が上
    return {
      leftUpperArm: { rot: [0, 0, -1.1 + up * 2.2] },
      rightUpperArm: { rot: [0, 0, 1.1 - (1 - up) * 2.2] },
      leftLowerArm: { rot: [0, 0, up * 0.15] },
      rightLowerArm: { rot: [0, 0, -(1 - up) * 0.15] },
    };
  },
  // 3: 両腕を前に出して左右にウェーブ(体の揺れも大きく)
  (b) => {
    const s = Math.sin(Math.PI * b);
    return {
      leftUpperArm: { rot: [0, -1.0, -0.5 + s * 0.35] },
      rightUpperArm: { rot: [0, 1.0, 0.5 + s * 0.35] },
      leftLowerArm: { rot: [0, -0.35, 0] },
      rightLowerArm: { rot: [0, 0.35, 0] },
    };
  },
];

function mix(a, b, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] || { rot: [0, 0, 0] };
    const y = b[k] || { rot: [0, 0, 0] };
    out[k] = { rot: x.rot.map((v, i) => v + (y.rot[i] - v) * t) };
  }
  return out;
}

export function dancePose(b) {
  const lb = ((b % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
  const i = Math.floor(lb / 8);
  const into = lb - i * 8; // その振りの何拍目か(0..8)
  let arms = MOVES[i](b);
  // 最後の1拍で次の振りへ混ぜる
  if (into > 7) arms = mix(arms, MOVES[(i + 1) % MOVES.length](b), smooth(into - 7));
  const pose = groove(b);
  if (i === 3) {
    // ウェーブの振りでは揺れを大きく
    pose.hips.pos[0] *= 1.6;
    pose.hips.rot[2] *= 1.6;
  }
  return { ...pose, ...arms };
}
