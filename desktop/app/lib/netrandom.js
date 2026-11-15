// System.Random (.NET Framework, Knuth subtractive): the weekly targets are drawn with new Random(week * 7919 + 13)
// in the VEGAS extension, so the same algorithm gives every Premiere player the same 5 targets as VEGAS players.
"use strict";
const MBIG = 2147483647, MSEED = 161803398;

class NetRandom {
  constructor(seed) {
    const a = new Array(56).fill(0);
    const sub = seed === -2147483648 ? 2147483647 : Math.abs(seed);
    let mj = MSEED - sub, mk = 1;
    a[55] = mj;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      a[ii] = mk; mk = mj - mk; if (mk < 0) mk += MBIG; mj = a[ii];
    }
    for (let k = 1; k < 5; k++) for (let i = 1; i < 56; i++) { a[i] -= a[1 + (i + 30) % 55]; if (a[i] < 0) a[i] += MBIG; }
    this.a = a; this.inext = 0; this.inextp = 21;
  }
  internalSample() {
    let n = this.inext, p = this.inextp;
    if (++n >= 56) n = 1;
    if (++p >= 56) p = 1;
    let r = this.a[n] - this.a[p];
    if (r === MBIG) r--;
    if (r < 0) r += MBIG;
    this.a[n] = r; this.inext = n; this.inextp = p;
    return r;
  }
  next(max) { return Math.floor(this.internalSample() * (1.0 / MBIG) * max); }
}

module.exports = { NetRandom };
