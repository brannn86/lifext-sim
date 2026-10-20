import { describe, expect, it } from 'vitest';
import * as E from '../src/engine';
import { loadBuiltins } from './helpers';

const { content } = loadBuiltins();

/** Plays a whole life, always picking the first choice. */
function playOut(life: E.Life, maxYears = 150) {
  for (let i = 0; i < maxYears && life.alive; i++) {
    while (life.pending.length) E.resolveEvent(content, life, 0);
    E.ageUp(content, life);
  }
  return life;
}

describe('life simulation', () => {
  it('creates a newborn with family and stats', () => {
    const life = E.createLife(content, { seed: 1, countryId: 'core:us' });
    expect(life.age).toBe(0);
    expect(life.people.filter((p) => p.role === 'parent')).toHaveLength(2);
    for (const s of content.stats.keys()) expect(life.stats[s]).toBeTypeOf('number');
  });

  it('is deterministic for the same seed and choices', () => {
    const a = playOut(E.createLife(content, { seed: 1234 }));
    const b = playOut(E.createLife(content, { seed: 1234 }));
    expect({ ...a, id: '' }).toEqual({ ...b, id: '' });
  });

  it('eventually dies and gets a ribbon', () => {
    const life = playOut(E.createLife(content, { seed: 99 }));
    expect(life.alive).toBe(false);
    expect(life.causeOfDeath).toBeTruthy();
    expect(life.ribbonId).toBeTruthy();
  });

  it('enrols in school automatically', () => {
    const life = E.createLife(content, { seed: 5 });
    for (let i = 0; i < 7 && life.alive; i++) {
      while (life.pending.length) E.resolveEvent(content, life, 0);
      E.ageUp(content, life);
    }
    if (life.alive) expect(life.education.current?.stageId ?? life.education.completed[0]).toBe('core:primary');
  });

  it('enforces once-per-year activities', () => {
    const life = E.createLife(content, { seed: 7 });
    life.age = 20;
    life.money = 1000;
    expect(E.doActivity(content, life, 'core:gym').ok).toBe(true);
    expect(E.doActivity(content, life, 'core:gym').ok).toBe(false);
  });

  it('can continue as a child who inherits', () => {
    const life = E.createLife(content, { seed: 11 });
    life.age = 40;
    life.money = 10000;
    const partner = life.people[0];
    partner.role = 'spouse';
    partner.gender = life.gender === 'male' ? 'female' : 'male';
    life.people.push({ ...partner, id: 999, role: 'child', age: 12, first: 'Kid' });
    E.kill(content, life, 'testing');
    const child = E.createChildLife(content, life, 999);
    expect(child.first).toBe('Kid');
    expect(child.age).toBe(12);
    expect(child.money).toBe(10000);
    expect(child.generation).toBe(2);
  });
});
