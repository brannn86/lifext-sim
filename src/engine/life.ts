// Creating lives: a brand-new birth, or continuing as a child of a dead life.

import { envOf, makeCtx } from './context';
import { evalNum } from './expr';
import { addLog } from './log';
import { randomSeed, rngFrom, type Rng } from './rng';
import type { Content, Gender, Life, Person, Role } from './types';

export interface NewLifeOptions {
  first?: string;
  last?: string;
  gender?: Gender;
  countryId?: string;
  seed?: number;
}

export function randomName(content: Content, rng: Rng, countryId: string, gender: Gender) {
  const country = content.countries.get(countryId);
  const firsts = content.names[country?.names[gender] ?? ''] ?? [];
  const lasts = content.names[country?.names.last ?? ''] ?? [];
  return { first: rng.pick(firsts) ?? 'Alex', last: rng.pick(lasts) ?? 'Smith' };
}

export function makePerson(
  life: Life,
  rng: Rng,
  content: Content,
  role: Role,
  age: number,
  opts: Partial<Person> = {},
): Person {
  const gender: Gender = opts.gender ?? (rng.chance(50) ? 'male' : 'female');
  const name = randomName(content, rng, life.countryId, gender);
  const p: Person = {
    id: life.nextPersonId++,
    first: name.first,
    last: name.last,
    gender,
    age,
    role,
    relationship: rng.int(50, 90),
    alive: true,
    looks: rng.int(10, 100),
    smarts: rng.int(10, 100),
    ...opts,
  };
  life.people.push(p);
  return p;
}

function blankLife(content: Content, seed: number): Life {
  return {
    version: 1,
    id: `life-${Date.now().toString(36)}-${(seed >>> 0).toString(36)}`,
    seed,
    rng: seed,
    generation: 1,
    first: '',
    last: '',
    gender: 'male',
    countryId: '',
    birthYear: content.config.startYear ?? new Date().getFullYear(),
    age: 0,
    alive: true,
    money: content.config.startMoney ?? 0,
    pension: 0,
    stats: {},
    flags: {},
    counters: {},
    people: [],
    nextPersonId: 1,
    job: null,
    education: { current: null, completed: [] },
    usedThisYear: [],
    firedOnce: [],
    lore: [],
    pending: [],
    log: [],
    mods: content.mods.map((m) => ({ id: m.id, version: m.version })),
  };
}

function rollStats(content: Content, life: Life) {
  const env = envOf(makeCtx(content, life));
  for (const def of content.stats.values()) {
    const v = evalNum(def.start, env, 50);
    life.stats[def.id] = Math.round(Math.min(def.max ?? 100, Math.max(def.min ?? 0, v)));
  }
}

export function createLife(content: Content, opts: NewLifeOptions = {}): Life {
  const seed = opts.seed ?? randomSeed();
  const life = blankLife(content, seed);
  const rng = rngFrom(life);

  life.countryId = opts.countryId ?? rng.pick([...content.countries.keys()]) ?? 'core:us';
  life.gender = opts.gender ?? (rng.chance(50) ? 'male' : 'female');
  const name = randomName(content, rng, life.countryId, life.gender);
  life.first = opts.first?.trim() || name.first;
  life.last = opts.last?.trim() || name.last;
  rollStats(content, life);

  const mother = makePerson(life, rng, content, 'parent', rng.int(18, 42), { gender: 'female', last: life.last });
  const father = makePerson(life, rng, content, 'parent', rng.int(18, 45), { gender: 'male', last: life.last });
  const siblings = rng.int(0, 2);
  for (let i = 0; i < siblings; i++) {
    makePerson(life, rng, content, 'sibling', rng.int(1, Math.max(1, Math.min(mother.age - 17, 10))), {
      last: life.last,
    });
  }

  const country = content.countries.get(life.countryId);
  addLog(life, `👶 I was born a ${life.gender === 'female' ? 'girl' : 'boy'} in ${country?.name ?? life.countryId}. My name is ${life.first} ${life.last}.`);
  addLog(life, `My mother is ${mother.first} ${mother.last} (${mother.age}) and my father is ${father.first} ${father.last} (${father.age}).`);
  return life;
}

/** Continue the family line as one of a dead life's children. */
export function createChildLife(content: Content, parent: Life, childId: number): Life {
  const child = parent.people.find((p) => p.id === childId && p.role === 'child' && p.alive);
  if (!child) throw new Error('That child is not available.');
  const life = blankLife(content, (parent.rng ^ (childId * 2654435761)) | 0);
  const rng = rngFrom(life);

  life.generation = parent.generation + 1;
  life.countryId = parent.countryId;
  life.gender = child.gender;
  life.first = child.first;
  life.last = child.last;
  life.age = child.age;
  life.birthYear = parent.birthYear + parent.age - child.age;
  rollStats(content, life);
  life.stats.looks = child.looks;
  life.stats.smarts = child.smarts;

  const heirs = parent.people.filter((p) => p.role === 'child' && p.alive);
  const inheritance = Math.max(0, Math.floor(parent.money / Math.max(1, heirs.length)));
  life.money = inheritance;

  // The dead parent, the surviving spouse (if any) and siblings carry over.
  life.people.push({
    id: life.nextPersonId++,
    first: parent.first,
    last: parent.last,
    gender: parent.gender,
    age: parent.age,
    role: 'parent',
    relationship: child.relationship,
    alive: false,
    looks: parent.stats.looks ?? 50,
    smarts: parent.stats.smarts ?? 50,
    causeOfDeath: parent.causeOfDeath,
  });
  const spouse = parent.people.find((p) => p.role === 'spouse' && p.alive);
  if (spouse) life.people.push({ ...spouse, id: life.nextPersonId++, role: 'parent', relationship: rng.int(50, 90) });
  for (const sib of heirs) {
    if (sib.id !== child.id) life.people.push({ ...sib, id: life.nextPersonId++, role: 'sibling' });
  }

  // Place the child in school according to age.
  for (const st of content.education.values()) {
    if (!st.auto || st.startAge === undefined) continue;
    if (life.age >= st.startAge + st.years) life.education.completed.push(st.id);
    else if (life.age >= st.startAge && !life.education.current) {
      life.education.current = { stageId: st.id, year: life.age - st.startAge, grades: life.stats.smarts ?? 50 };
    }
  }

  const c = content.countries.get(life.countryId);
  addLog(life, `🌱 You are ${life.first} ${life.last}, ${life.age} years old, child of the late ${parent.first} ${parent.last} (generation ${life.generation}).`);
  if (inheritance > 0) addLog(life, `You inherited ${c?.currency ?? '$'}${inheritance.toLocaleString('en-US')}.`);
  return life;
}
