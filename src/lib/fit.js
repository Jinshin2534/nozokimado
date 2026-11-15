// 読み込んだモデルを空間に収める拡大率と位置(純粋関数)。
// box: モデルの外接箱 {min:{x,y,z}, max:{x,y,z}}。space: 置き場所の大きさ {width,height,depth}(m)。
// size は 0.3〜1.5 の倍率(ユーザー調整)。底面を y=0、中心を x=z=0 に合わせる。
export function fitModel(box, space, size = 1) {
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;
  if (!(dx > 0 || dy > 0 || dz > 0)) return { scale: 1, offset: { x: 0, y: 0, z: 0 } };
  const scale =
    Math.min(
      dy > 0 ? (space.height * 0.8) / dy : Infinity,
      dx > 0 ? (space.width * 0.8) / dx : Infinity,
      dz > 0 ? (space.depth * 0.8) / dz : Infinity,
    ) * size;
  return {
    scale,
    offset: {
      x: -((box.min.x + box.max.x) / 2) * scale,
      y: -box.min.y * scale,
      z: -((box.min.z + box.max.z) / 2) * scale,
    },
  };
}
