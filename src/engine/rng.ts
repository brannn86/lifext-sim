// Seeded PRNG (mulberry32). The state lives on the object passed in (usually a
// Life), so a life is fully reproducible from its seed and its choices.

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [a, b], inclusive. */
  int(a: number, b: number): number;
  /** True with `percent` % probability. */
  chance(percent: number): boolean;
  pick<T>(items: readonly T[]): T | undefined;
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
}

export function rngFrom(holder: { rng: number }): Rng {
  const next = () => {
    let s = (holder.rng + 0x6d2b79f5) | 0;
    holder.rng = s;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(a, b) {
      const lo = Math.ceil(Math.min(a, b));
      const hi = Math.floor(Math.max(a, b));
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    chance(percent) {
      return next() * 100 < percent;
    },
    pick(items) {
      return items.length ? items[Math.floor(next() * items.length)] : undefined;
    },
    weighted(items, weight) {
      const ws = items.map((i) => Math.max(0, Number(weight(i)) || 0));
      const total = ws.reduce((a, b) => a + b, 0);
      if (total <= 0) return undefined;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= ws[i];
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32) | 0;
}
