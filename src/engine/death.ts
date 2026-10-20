// Death and end-of-life ribbons.

import { envOf, makeCtx } from './context';
import { evalBool, evalNum } from './expr';
import { addLog } from './log';
import type { Content, Life, RibbonDef } from './types';

export function kill(content: Content, life: Life, cause: string) {
  if (!life.alive) return;
  life.alive = false;
  life.causeOfDeath = cause;
  life.pending = [];
  addLog(life, `💀 You died at age ${life.age} from ${cause}.`);
  const ribbon = pickRibbon(content, life);
  if (ribbon) {
    life.ribbonId = ribbon.id;
    addLog(life, `${ribbon.icon ?? '🎗️'} Your life earned the "${ribbon.name}" ribbon.`);
  }
}

/** Highest-priority ribbon whose condition matches. */
export function pickRibbon(content: Content, life: Life): RibbonDef | undefined {
  const sorted = [...content.ribbons.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const r of sorted) {
    const env = envOf(makeCtx(content, life, r.mod));
    if (evalBool(r.when, env)) return r;
  }
  return undefined;
}

/** Yearly death roll. Returns true if the player died. */
export function deathCheck(content: Content, life: Life): boolean {
  const ctx = makeCtx(content, life);
  if ((life.stats.health ?? 100) <= 0) {
    kill(content, life, 'poor health');
    return true;
  }
  const p = evalNum(content.config.deathChance, envOf(ctx));
  if (ctx.rng.next() < p) {
    const env = envOf(ctx);
    const causes = content.config.deathCauses.filter((c) => evalBool(c.when, env));
    const cause = ctx.rng.weighted(causes, (c) => evalNum(c.weight, env, 1));
    kill(content, life, cause?.text ?? 'natural causes');
    return true;
  }
  return false;
}
