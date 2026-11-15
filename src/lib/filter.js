// One Euro Filter: 止まっている時はしっかり揺れを抑え、速く動いた時は遅れを減らす。
// t は秒。値は数値1つ(x,y,z に1個ずつ使う)。

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuro {
  constructor({ minCutoff = 1.0, beta = 0.02, dCutoff = 1.0 } = {}) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.reset();
  }
  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }
  filter(value, t) {
    if (this.x === null || !(t > this.t)) {
      if (this.x === null) {
        this.x = value;
        this.t = t;
      }
      return this.x;
    }
    const dt = t - this.t;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    this.t = t;
    return this.x;
  }
}

export class OneEuro3 {
  constructor(opts) {
    this.f = [new OneEuro(opts), new OneEuro(opts), new OneEuro(opts)];
  }
  reset() {
    this.f.forEach((f) => f.reset());
  }
  filter(p, t) {
    return { x: this.f[0].filter(p.x, t), y: this.f[1].filter(p.y, t), z: this.f[2].filter(p.z, t) };
  }
}
