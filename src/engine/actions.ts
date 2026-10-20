// Player actions (everything except "Age +"). Each returns an ActionResult the
// UI shows as a popup; every action also writes to the life log.

import { envOf, makeCtx, peekCtx, personTitle, salaryFor, type Ctx } from './context';
import { evalBool, evalNum } from './expr';
import { makePerson } from './life';
import { addLog } from './log';
import { runRunnable } from './outcomes';
import type { ActionResult, ActivityDef, CareerDef, Content, EducationDef, Gender, InteractionDef, Life, Person } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fail = (message: string): ActionResult => ({ ok: false, message });

function money(content: Content, life: Life, n: number) {
  const cur = content.countries.get(life.countryId)?.currency ?? '$';
  return `${cur}${Math.round(n).toLocaleString('en-US')}`;
}

function busy(life: Life): ActionResult | null {
  if (!life.alive) return fail('You are dead.');
  if (life.pending.length) return fail('Deal with what is happening first.');
  return null;
}

function used(life: Life, key: string) {
  return life.usedThisYear.includes(key);
}

function finish(life: Life, title: string, lines: string[], key?: string): ActionResult {
  if (key) life.usedThisYear.push(key);
  for (const l of lines) addLog(life, l);
  return { ok: true, title, message: lines.join('\n') };
}

// ----------------------------------------------------------- availability ----

export interface Availability {
  /** Visible at all (age range / `when`). */
  visible: boolean;
  /** Usable right now. */
  enabled: boolean;
  reason?: string;
}

function ageOk(def: { minAge?: number; maxAge?: number }, age: number) {
  return (def.minAge === undefined || age >= def.minAge) && (def.maxAge === undefined || age <= def.maxAge);
}

export function activityStatus(content: Content, life: Life, a: ActivityDef): Availability & { cost: number } {
  const env = envOf(peekCtx(content, life, a.mod));
  const cost = evalNum(a.cost, env);
  if (!ageOk(a, life.age) || !evalBool(a.when, env)) return { visible: false, enabled: false, cost };
  if (a.oncePerYear !== false && used(life, a.id)) return { visible: true, enabled: false, reason: 'Done this year', cost };
  if (cost > 0 && life.money < cost) return { visible: true, enabled: false, reason: "Can't afford", cost };
  return { visible: true, enabled: true, cost };
}

// ------------------------------------------------------------- activities ----

export function doActivity(content: Content, life: Life, id: string): ActionResult {
  const b = busy(life);
  if (b) return b;
  const a = content.activities.get(id);
  if (!a) return fail('Unknown activity.');
  const status = activityStatus(content, life, a);
  if (!status.enabled) return fail(status.reason ?? "You can't do that right now.");
  life.money -= status.cost;
  const lines = runRunnable(a, makeCtx(content, life, a.mod, { vars: {} }));
  return finish(life, `${a.icon ?? ''} ${a.label}`.trim(), lines.length ? lines : [`You did: ${a.label}.`], a.oncePerYear !== false ? a.id : undefined);
}

// -------------------------------------------------------------- education ----

export function educationOptions(content: Content, life: Life) {
  return [...content.education.values()]
    .filter((st) => !st.auto && !life.education.completed.includes(st.id))
    .map((st) => {
      const env = envOf(peekCtx(content, life, st.mod));
      const ok = (st.minAge ?? 0) <= life.age && evalBool(st.requires, env) && !life.education.current;
      return { stage: st, eligible: ok };
    });
}

export function applyToSchool(content: Content, life: Life, stageId: string): ActionResult {
  const b = busy(life);
  if (b) return b;
  const st: EducationDef | undefined = content.education.get(stageId);
  if (!st) return fail('Unknown school.');
  if (life.education.current) return fail('You are already in school.');
  const key = `apply:${st.id}`;
  if (used(life, key)) return fail('You already applied this year.');
  const ctx = makeCtx(content, life, st.mod);
  if (life.age < (st.minAge ?? 0) || !evalBool(st.requires, envOf(ctx))) return fail("You don't meet the requirements.");
  if (ctx.rng.chance(evalNum(st.acceptChance, envOf(ctx), 100))) {
    life.education.current = { stageId: st.id, year: 0, grades: clamp(life.stats.smarts ?? 50, 0, 100) };
    life.stats.happiness = clamp((life.stats.happiness ?? 50) + 5, 0, 100);
    return finish(life, '🎉 Accepted!', [`You were accepted into ${st.name}!`], key);
  }
  return finish(life, '✉️ Rejected', [`${st.name} rejected your application.`], key);
}

export function studyHarder(content: Content, life: Life): ActionResult {
  const b = busy(life);
  if (b) return b;
  const cur = life.education.current;
  if (!cur) return fail("You're not in school.");
  if (used(life, 'study')) return fail('You already did that this year.');
  const rng = makeCtx(content, life).rng;
  cur.grades = clamp(cur.grades + rng.int(4, 10), 0, 100);
  life.stats.smarts = clamp((life.stats.smarts ?? 50) + rng.int(1, 3), 0, 100);
  life.stats.happiness = clamp((life.stats.happiness ?? 50) - rng.int(0, 2), 0, 100);
  return finish(life, '📚 Study', ['You studied harder. Your grades improved.'], 'study');
}

export function dropOut(content: Content, life: Life): ActionResult {
  const b = busy(life);
  if (b) return b;
  const cur = life.education.current;
  if (!cur) return fail("You're not in school.");
  const st = content.education.get(cur.stageId);
  if (st?.auto && life.age < 16) return fail('You are too young to drop out.');
  life.education.current = null;
  life.flags.dropout = true;
  return finish(life, '🚪 Dropped out', [`You dropped out of ${st?.name ?? 'school'}.`]);
}

// ------------------------------------------------------------------- jobs ----

export function jobListings(content: Content, life: Life) {
  return [...content.careers.values()]
    .filter((c) => ageOk(c, life.age))
    .map((c) => {
      const env = envOf(peekCtx(content, life, c.mod));
      return { career: c, qualified: evalBool(c.requires, env), applied: used(life, `job:${c.id}`) };
    });
}

export function applyForJob(content: Content, life: Life, careerId: string): ActionResult {
  const b = busy(life);
  if (b) return b;
  const c: CareerDef | undefined = content.careers.get(careerId);
  if (!c) return fail('Unknown job.');
  if (life.job?.careerId === c.id) return fail('You already work there.');
  const key = `job:${c.id}`;
  if (used(life, key)) return fail('You already applied there this year.');
  if (!ageOk(c, life.age)) return fail("You're not the right age for this job.");
  const ctx = makeCtx(content, life, c.mod);
  if (!evalBool(c.requires, envOf(ctx))) return finish(life, '✉️ Rejected', [`You don't meet the requirements to be a ${c.titles[0]}.`], key);
  if (!ctx.rng.chance(evalNum(c.applyChance, envOf(ctx), 60))) {
    return finish(life, '✉️ Rejected', [`You applied to be a ${c.titles[0]}, but they didn't hire you.`], key);
  }
  const previous = life.job;
  life.job = { careerId: c.id, level: 0, performance: 50, years: 0, levelYears: 0 };
  delete life.flags.retired;
  life.pension = 0;
  const lines = [`You were hired as a ${c.titles[0]}! Salary: ${money(content, life, c.salary)}/yr.`];
  if (previous) lines.unshift('You quit your old job.');
  return finish(life, '💼 Hired!', lines, key);
}

export function workHarder(content: Content, life: Life): ActionResult {
  const b = busy(life);
  if (b) return b;
  if (!life.job) return fail("You don't have a job.");
  if (used(life, 'work')) return fail('You already did that this year.');
  const rng = makeCtx(content, life).rng;
  life.job.performance = clamp(life.job.performance + rng.int(6, 15), 0, 100);
  life.stats.happiness = clamp((life.stats.happiness ?? 50) - rng.int(0, 3), 0, 100);
  return finish(life, '💪 Work harder', ['You worked harder at your job.'], 'work');
}

export function quitJob(content: Content, life: Life): ActionResult {
  const b = busy(life);
  if (b) return b;
  if (!life.job) return fail("You don't have a job.");
  const name = content.careers.get(life.job.careerId)?.titles[life.job.level] ?? 'job';
  life.job = null;
  return finish(life, '👋 Quit', [`You quit your job as a ${name}.`]);
}

export function retire(content: Content, life: Life): ActionResult {
  const b = busy(life);
  if (b) return b;
  if (!life.job) return fail("You don't have a job.");
  if (life.age < content.config.retirementAge) return fail(`You can retire at ${content.config.retirementAge}.`);
  const c = content.careers.get(life.job.careerId);
  const salary = c ? salaryFor(c.salary, c.raise, life.job.level) : 0;
  life.pension = Math.round(salary * content.config.pensionRate);
  life.job = null;
  life.flags.retired = true;
  return finish(life, '🏖️ Retired', [`You retired with a pension of ${money(content, life, life.pension)}/yr.`]);
}

// ----------------------------------------------------------------- people ----

export function interactionsFor(content: Content, life: Life, p: Person) {
  if (!p.alive) return [];
  return [...content.interactions.values()]
    .filter((i) => i.targets.includes(p.role) && life.age >= (i.minAge ?? 0))
    .filter((i) => evalBool(i.when, envOf(peekCtx(content, life, i.mod, { npc: p }))))
    .map((i) => ({ def: i, done: used(life, `${i.id}@${p.id}`) }));
}

export function interact(content: Content, life: Life, personId: number, interactionId: string): ActionResult {
  const b = busy(life);
  if (b) return b;
  const p = life.people.find((x) => x.id === personId);
  const i: InteractionDef | undefined = content.interactions.get(interactionId);
  if (!p || !p.alive || !i) return fail('They are not available.');
  const key = `${i.id}@${p.id}`;
  if (used(life, key)) return fail('You already did that this year.');
  const ctx: Ctx = makeCtx(content, life, i.mod, { npc: p, vars: {} });
  const cost = evalNum(i.cost, envOf(ctx));
  if (cost > 0 && life.money < cost) return fail("You can't afford it.");
  life.money -= cost;
  const lines = runRunnable(i, ctx);
  return finish(life, `${i.label}: ${p.first}`, lines.length ? lines : [`You: ${i.label} with ${p.first}.`], key);
}

export function partnerOf(life: Life): Person | undefined {
  return life.people.find((p) => p.alive && (p.role === 'partner' || p.role === 'spouse'));
}

export function findDate(content: Content, life: Life, gender: Gender): ActionResult {
  const b = busy(life);
  if (b) return b;
  if (life.age < 16) return fail("You're too young to date.");
  if (partnerOf(life)) return fail('You are already in a relationship.');
  if (used(life, 'date')) return fail('You already looked for love this year.');
  const ctx = makeCtx(content, life);
  const rng = ctx.rng;
  const age = clamp(life.age + rng.int(-4, 4), 16, 120);
  const candidate = { looks: rng.int(10, 100) };
  const chance = 35 + ((life.stats.looks ?? 50) - candidate.looks) / 2 + (life.stats.happiness ?? 50) / 5;
  if (!rng.chance(chance)) {
    return finish(life, '💘 Dating', ["You went on a few dates but nothing clicked."], 'date');
  }
  const p = makePerson(life, rng, content, 'partner', age, { gender, looks: candidate.looks, relationship: rng.int(45, 75) });
  life.stats.happiness = clamp((life.stats.happiness ?? 50) + rng.int(3, 8), 0, 100);
  return finish(life, '💘 Dating', [`You started dating ${p.first} ${p.last} (${p.age}).`], 'date');
}

export function makeFriend(content: Content, life: Life): ActionResult {
  const b = busy(life);
  if (b) return b;
  if (life.age < 5) return fail("You're too young.");
  if (used(life, 'friend')) return fail('You already tried that this year.');
  const rng = makeCtx(content, life).rng;
  if (!rng.chance(55 + (life.stats.happiness ?? 50) / 5)) {
    return finish(life, '🤝 Friends', ["You tried to make a friend, but it didn't work out."], 'friend');
  }
  const p = makePerson(life, rng, content, 'friend', clamp(life.age + rng.int(-2, 2), 4, 120));
  return finish(life, '🤝 Friends', [`You became friends with ${p.first} ${p.last}.`], 'friend');
}

export function propose(content: Content, life: Life, personId: number): ActionResult {
  const b = busy(life);
  if (b) return b;
  const p = life.people.find((x) => x.id === personId && x.alive && x.role === 'partner');
  if (!p) return fail('You can only propose to your partner.');
  if (life.age < 18) return fail("You're too young to marry.");
  if (used(life, 'propose')) return fail('You already proposed this year.');
  const rng = makeCtx(content, life).rng;
  if (rng.chance(p.relationship - 10)) {
    p.role = 'spouse';
    p.relationship = clamp(p.relationship + 10, 0, 100);
    life.flags.married = true;
    life.counters.marriages = (life.counters.marriages ?? 0) + 1;
    life.stats.happiness = clamp((life.stats.happiness ?? 50) + rng.int(10, 20), 0, 100);
    return finish(life, '💍 Married!', [`${p.first} said yes! You got married.`], 'propose');
  }
  p.relationship = clamp(p.relationship - rng.int(10, 20), 0, 100);
  return finish(life, '💍 Proposal', [`${p.first} said no...`], 'propose');
}

export function breakUp(content: Content, life: Life, personId: number): ActionResult {
  const b = busy(life);
  if (b) return b;
  const p = life.people.find((x) => x.id === personId && x.alive && (x.role === 'partner' || x.role === 'spouse'));
  if (!p) return fail("You're not with them.");
  const wasSpouse = p.role === 'spouse';
  p.role = 'ex';
  p.relationship = clamp(p.relationship - 30, 0, 100);
  const lines = [wasSpouse ? `You divorced ${p.first}.` : `You broke up with ${p.first}.`];
  if (wasSpouse && life.money > 0) {
    const half = Math.round(life.money / 2);
    life.money -= half;
    lines.push(`${p.first} got ${money(content, life, half)} in the divorce.`);
  }
  return finish(life, '💔 Breakup', lines);
}

export function tryForBaby(content: Content, life: Life, personId: number): ActionResult {
  const b = busy(life);
  if (b) return b;
  const p = life.people.find((x) => x.id === personId && x.alive && (x.role === 'partner' || x.role === 'spouse'));
  if (!p) return fail('You need a partner for that.');
  if (life.age < 18) return fail("You're too young.");
  if (p.gender === life.gender) return fail('You will need to adopt (coming in a future update).');
  if (used(life, 'baby')) return fail('You already tried this year.');
  const mother = life.gender === 'female' ? life.age : p.age;
  const rng = makeCtx(content, life).rng;
  const chance = mother > 45 ? 2 : mother > 38 ? 20 : 45;
  if (!rng.chance(chance)) return finish(life, '🍼 Baby', ['No luck this year.'], 'baby');
  const kid = makePerson(life, rng, content, 'child', 0, {
    last: life.last,
    relationship: rng.int(80, 100),
    looks: clamp(Math.round(((life.stats.looks ?? 50) + p.looks) / 2 + rng.int(-15, 15)), 0, 100),
    smarts: clamp(Math.round(((life.stats.smarts ?? 50) + p.smarts) / 2 + rng.int(-15, 15)), 0, 100),
  });
  life.stats.happiness = clamp((life.stats.happiness ?? 50) + rng.int(5, 15), 0, 100);
  return finish(life, '🍼 Baby', [`${personTitle(kid)} ${kid.first} was born!`], 'baby');
}
