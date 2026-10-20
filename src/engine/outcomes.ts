// Shared runner for anything shaped like { text, effects, outcomes }:
// activities, interactions, auto events and event choices.

import { envOf, type Ctx } from './context';
import { runEffects } from './effects';
import { evalBool, evalNum } from './expr';
import { fillText } from './text';
import type { Outcome } from './types';

export interface Runnable {
  text?: string;
  effects?: string[];
  outcomes?: Outcome[];
}

/**
 * Applies `effects` + `text`, then one weighted `outcome` (its effects + text).
 * Text is filled after effects, so it can show values the effects stored in
 * vars (e.g. `vars.amount = rand(10, 80)` then "You got {amount}").
 * Returns the resulting message lines.
 */
export function runRunnable(r: Runnable, ctx: Ctx): string[] {
  const lines = runPart(r, ctx);
  if (r.outcomes?.length && ctx.life.alive) {
    const env = envOf(ctx);
    const options = r.outcomes.filter((o) => evalBool(o.when, env));
    const o = ctx.rng.weighted(options, (x) => evalNum(x.weight, env, 1));
    if (o) lines.push(...runPart(o, ctx));
  }
  return lines.filter(Boolean);
}

function runPart(part: { text?: string; effects?: string[] }, ctx: Ctx): string[] {
  const extra = runEffects(part.effects, ctx);
  return [fillText(part.text, envOf(ctx)), ...extra];
}
