// The yearly tick: everything that happens when the player presses "Age +".

import { envOf, makeCtx, peekCtx, personTitle, salaryFor, type Ctx } from './context';
import { deathCheck } from './death';
import { evalBool, evalNum } from './expr';
import { addLog } from './log';
import { runRunnable } from './outcomes';
import { fillText } from './text';
import type { Content, EventDef, Life, PendingEvent } from './types';

export interface TickReport {
  /** Ids of events that fired this year (for the sim script / debugging). */
  events: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ageUp(content: Content, life: Life): TickReport {
  const report: TickReport = { events: [] };
  if (!life.alive || life.pending.length) return report;

  life.age++;
  life.usedThisYear = [];
  life.log.push({ age: life.age, entries: [] });

  const ctx = makeCtx(content, life);
  driftStats(ctx);
  tickPeople(ctx);
  tickEducation(ctx);
  tickJob(ctx);
  if (life.pension > 0) life.money += life.pension;
  payLivingCost(ctx);
  if (life.alive) rollEvents(ctx, report);
  if (life.alive) deathCheck(content, life);
  return report;
}

function driftStats(ctx: Ctx) {
  const { life, content } = ctx;
  for (const def of content.stats.values()) {
    if (def.drift === undefined) continue;
    const delta = evalNum(def.drift, envOf({ ...ctx, modId: def.mod }));
    const v = (life.stats[def.id] ?? 0) + delta;
    life.stats[def.id] = Math.round(clamp(v, def.min ?? 0, def.max ?? 100));
  }
}

function tickPeople(ctx: Ctx) {
  const { life, content, rng } = ctx;
  for (const p of life.people) {
    if (!p.alive) continue;
    p.age++;
    const npcEnv = { scope: { age: p.age }, rng };
    if (rng.next() < evalNum(content.config.npcDeathChance, npcEnv)) {
      p.alive = false;
      p.causeOfDeath = 'natural causes';
      addLog(life, `🕊️ Your ${personTitle(p).toLowerCase()} ${p.first} ${p.last} died at age ${p.age}.`);
      const grief = p.relationship > 50 ? rng.int(10, 25) : rng.int(2, 8);
      life.stats.happiness = clamp((life.stats.happiness ?? 50) - grief, 0, 100);
      if (p.role === 'spouse' || p.role === 'partner') life.flags.widowed = true;
      continue;
    }
    p.relationship = clamp(p.relationship - evalNum(content.config.relationshipDecay, envOf(ctx)), 0, 100);
    if ((p.role === 'partner' || p.role === 'spouse') && p.relationship < 10 && rng.chance(40)) {
      addLog(life, `💔 ${p.first} ${p.role === 'spouse' ? 'divorced' : 'broke up with'} you.`);
      if (p.role === 'spouse') life.money = Math.round(life.money / 2);
      p.role = 'ex';
      life.stats.happiness = clamp((life.stats.happiness ?? 50) - rng.int(5, 15), 0, 100);
    }
  }
}

function tickEducation(ctx: Ctx) {
  const { life, content, rng } = ctx;
  const ed = life.education;
  if (ed.current) {
    const stage = content.education.get(ed.current.stageId);
    if (!stage) {
      ed.current = null;
    } else {
      ed.current.year++;
      const smarts = life.stats.smarts ?? 50;
      ed.current.grades = Math.round(clamp(ed.current.grades + (smarts - ed.current.grades) * 0.3 + rng.int(-5, 5), 0, 100));
      const cost = evalNum(stage.costPerYear, envOf(ctx));
      if (cost) life.money -= cost;
      if (ed.current.year >= stage.years) {
        ed.completed.push(stage.id);
        addLog(life, `🎓 You graduated from ${stage.name} (grades: ${ed.current.grades}%).`);
        ed.current = null;
      }
    }
  }
  if (!ed.current) {
    for (const st of content.education.values()) {
      if (!st.auto || st.startAge !== life.age || ed.completed.includes(st.id)) continue;
      if (!evalBool(st.requires, envOf({ ...ctx, modId: st.mod }))) continue;
      ed.current = { stageId: st.id, year: 0, grades: Math.round(clamp((life.stats.smarts ?? 50) + rng.int(-10, 10), 0, 100)) };
      addLog(life, `🏫 You started ${st.name}.`);
      break;
    }
  }
}

function tickJob(ctx: Ctx) {
  const { life, content, rng } = ctx;
  const job = life.job;
  if (!job) return;
  const career = content.careers.get(job.careerId);
  if (!career) {
    life.job = null;
    return;
  }
  if (career.maxAge !== undefined && life.age > career.maxAge) {
    addLog(life, `⏳ Your career as a ${career.titles[job.level]} came to an end. You're too old for it now.`);
    life.job = null;
    return;
  }
  job.years++;
  job.levelYears++;
  life.money += salaryFor(career.salary, career.raise, job.level);
  job.performance = Math.round(clamp(job.performance + rng.int(-8, 4), 0, 100));
  if (job.performance >= 75 && job.levelYears >= 2 && job.level < career.titles.length - 1 && rng.chance(50)) {
    job.level++;
    job.levelYears = 0;
    job.performance = 50;
    addLog(life, `📈 You were promoted to ${career.titles[job.level]}!`);
    life.stats.happiness = clamp((life.stats.happiness ?? 50) + rng.int(5, 10), 0, 100);
  } else if (job.performance < 20 && rng.chance(40)) {
    addLog(life, `📉 You were fired from your job as ${career.titles[job.level]}.`);
    life.job = null;
    life.flags.fired = true;
    life.stats.happiness = clamp((life.stats.happiness ?? 50) - rng.int(5, 15), 0, 100);
  }
}

function payLivingCost(ctx: Ctx) {
  const { life, content } = ctx;
  const cost = Math.max(0, evalNum(content.config.livingCost, envOf(ctx)));
  // You scrape by rather than fall into debt just from living.
  life.money -= Math.round(Math.min(cost, Math.max(0, life.money)));
}

// --------------------------------------------------------------- events ----

export function eventEligible(e: EventDef, ctx: Ctx): boolean {
  const { life } = ctx;
  if (e.minAge !== undefined && life.age < e.minAge) return false;
  if (e.maxAge !== undefined && life.age > e.maxAge) return false;
  if (e.once && life.firedOnce.includes(e.id)) return false;
  return evalBool(e.when, envOf({ ...ctx, modId: e.mod }));
}

function rollEvents(ctx: Ctx, report: TickReport) {
  const { content, rng } = ctx;
  const count = Math.max(0, Math.round(evalNum(content.config.eventsPerYear, envOf(ctx))));
  const picked = new Set<string>();
  for (let i = 0; i < count && ctx.life.alive; i++) {
    const candidates = [...content.events.values()].filter((e) => !picked.has(e.id) && eventEligible(e, ctx));
    const e = rng.weighted(candidates, (ev) => evalNum(ev.weight, envOf({ ...ctx, modId: ev.mod }), 1));
    if (!e) break;
    picked.add(e.id);
    report.events.push(e.id);
    fireEvent(e, ctx);
  }
}

/** Fires an event now: auto events apply immediately, choice events queue up. */
export function fireEvent(e: EventDef, ctx: Ctx) {
  const { life } = ctx;
  if (e.once) life.firedOnce.push(e.id);
  const ectx: Ctx = { ...ctx, modId: e.mod, vars: {} };
  for (const [k, src] of Object.entries(e.vars ?? {})) {
    ectx.vars![k] = evalNum(src, envOf(ectx));
  }
  if (e.choices?.length) {
    const pending: PendingEvent = { eventId: e.id, text: fillText(e.text, envOf(ectx)), vars: { ...ectx.vars } };
    life.pending.push(pending);
    return;
  }
  for (const line of runRunnable(e, ectx)) addLog(life, line);
}

/** The choices of the first pending event the player can currently pick. */
export function pendingChoices(content: Content, life: Life) {
  const pending = life.pending[0];
  if (!pending) return [];
  const e = content.events.get(pending.eventId);
  if (!e?.choices) return [];
  const ctx = peekCtx(content, life, e.mod, { vars: { ...pending.vars } });
  return e.choices
    .map((c, index) => ({ index, label: fillText(c.label, envOf(ctx)), choice: c }))
    .filter((c) => evalBool(c.choice.when, envOf(ctx)));
}

/** Resolve the first pending event with the chosen option. */
export function resolveEvent(content: Content, life: Life, choiceIndex: number): string {
  const pending = life.pending.shift();
  if (!pending) return '';
  const e = content.events.get(pending.eventId);
  const choice = e?.choices?.[choiceIndex];
  if (!e || !choice) return '';
  const ctx = makeCtx(content, life, e.mod, { vars: { ...pending.vars } });
  addLog(life, `${pending.text} → ${fillText(choice.label, envOf(ctx))}`);
  const lines = runRunnable(choice, ctx);
  for (const line of lines) addLog(life, line);
  return lines.join('\n');
}
