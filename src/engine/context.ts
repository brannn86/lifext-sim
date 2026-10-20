// Builds the read-only view of a life that expressions see, plus life-aware
// helper functions. This is the "API surface" available to mod content.

import type { Env, Fn } from './expr';
import { rngFrom, type Rng } from './rng';
import type { Content, Life, Person, Role } from './types';

/** Everything an effect or expression may need while running. */
export interface Ctx {
  content: Content;
  life: Life;
  rng: Rng;
  /** Mod whose content is running; used to qualify unprefixed ids. */
  modId: string;
  npc?: Person;
  vars?: Record<string, number | string | boolean>;
}

export function makeCtx(content: Content, life: Life, modId = 'core', extra: Partial<Ctx> = {}): Ctx {
  return { content, life, rng: rngFrom(life), modId, ...extra };
}

/**
 * Context for read-only queries (UI availability checks). Uses a detached copy
 * of the RNG so evaluating `when` conditions never changes the life.
 */
export function peekCtx(content: Content, life: Life, modId = 'core', extra: Partial<Ctx> = {}): Ctx {
  return { content, life, rng: rngFrom({ rng: life.rng }), modId, ...extra };
}

/** "doctor" + mod "core" -> "core:doctor"; already-qualified ids pass through. */
export function qualify(id: string, modId: string): string {
  return id.includes(':') ? id : `${modId}:${id}`;
}

export function pronouns(gender: string) {
  return gender === 'female'
    ? { he: 'she', him: 'her', his: 'her' }
    : { he: 'he', him: 'him', his: 'his' };
}

const TITLES: Record<Role, [string, string]> = {
  parent: ['Father', 'Mother'],
  sibling: ['Brother', 'Sister'],
  partner: ['Boyfriend', 'Girlfriend'],
  spouse: ['Husband', 'Wife'],
  child: ['Son', 'Daughter'],
  friend: ['Friend', 'Friend'],
  ex: ['Ex', 'Ex'],
};

export function personTitle(p: Person): string {
  return TITLES[p.role][p.gender === 'female' ? 1 : 0];
}

export function personView(p: Person) {
  return {
    id: p.id,
    name: `${p.first} ${p.last}`,
    first: p.first,
    last: p.last,
    gender: p.gender,
    age: p.age,
    role: p.role,
    title: personTitle(p).toLowerCase(),
    relationship: p.relationship,
    looks: p.looks,
    smarts: p.smarts,
    alive: p.alive,
    ...pronouns(p.gender),
  };
}

export function jobView(content: Content, life: Life) {
  const job = life.job;
  if (!job) return null;
  const c = content.careers.get(job.careerId);
  return {
    id: job.careerId,
    name: c?.name ?? job.careerId,
    title: c?.titles[Math.min(job.level, c.titles.length - 1)] ?? job.careerId,
    category: c?.category ?? '',
    level: job.level,
    performance: job.performance,
    years: job.years,
    salary: c ? salaryFor(c.salary, c.raise, job.level) : 0,
  };
}

export function salaryFor(base: number, raise: number | undefined, level: number): number {
  return Math.round(base * (1 + level * (raise ?? 0.3)));
}

export function scopeOf(ctx: Ctx): Record<string, unknown> {
  const { content, life } = ctx;
  const country = content.countries.get(life.countryId);
  const partner = life.people.find((p) => p.alive && (p.role === 'spouse' || p.role === 'partner'));
  return {
    age: life.age,
    year: life.birthYear + life.age,
    money: life.money,
    name: `${life.first} ${life.last}`,
    first: life.first,
    last: life.last,
    gender: life.gender,
    generation: life.generation,
    country: life.countryId,
    countryName: country?.name ?? life.countryId,
    currency: country?.currency ?? '$',
    stats: life.stats,
    flags: life.flags,
    counters: life.counters,
    job: jobView(content, life),
    education: {
      current: life.education.current?.stageId ?? null,
      grades: life.education.current?.grades ?? 0,
      completed: life.education.completed,
    },
    partner: partner ? personView(partner) : null,
    npc: ctx.npc ? personView(ctx.npc) : null,
    vars: ctx.vars ?? {},
    ...pronouns(life.gender),
    ...(ctx.vars ?? {}),
  };
}

function helpers(ctx: Ctx): Record<string, Fn> {
  const { life } = ctx;
  return {
    has: (_e, flag) => !!life.flags[String(flag)],
    counter: (_e, key) => life.counters[String(key)] ?? 0,
    count: (_e, role) => life.people.filter((p) => p.alive && p.role === role).length,
    hasJob: () => life.job !== null,
    inSchool: () => life.education.current !== null,
    completed: (_e, stage) => life.education.completed.includes(qualify(String(stage), ctx.modId)),
    hasLore: (_e, id) => life.lore.includes(qualify(String(id), ctx.modId)),
  };
}

export function envOf(ctx: Ctx): Env {
  return { scope: scopeOf(ctx), rng: ctx.rng, fns: helpers(ctx) };
}
