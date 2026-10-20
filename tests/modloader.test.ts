import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/engine';
import { available, coreMod, exampleMod, loadBuiltins } from './helpers';
import type { ModSource } from '../src/engine/types';

const mod = (files: Record<string, string>): ModSource => ({ files, builtin: false });

describe('mod loader', () => {
  it('loads the built-in mods without errors', () => {
    const { content, errors, loaded } = loadBuiltins();
    expect(errors).toEqual([]);
    expect(loaded).toEqual(['core', 'example']);
    expect(content.events.size).toBeGreaterThan(20);
    expect(content.countries.has('example:japan')).toBe(true);
  });

  it('namespaces ids but not stats', () => {
    const { content } = loadBuiltins(false);
    expect(content.careers.has('core:doctor')).toBe(true);
    expect(content.stats.has('happiness')).toBe(true);
  });

  it('applies patches from the example expansion', () => {
    const base = loadBuiltins(false).content;
    const patched = loadBuiltins(true).content;
    expect(base.careers.get('core:doctor')!.salary).toBe(120000);
    expect(patched.careers.get('core:doctor')!.salary).toBe(150000);
    expect(patched.events.get('core:found_wallet')!.choices!.length).toBe(base.events.get('core:found_wallet')!.choices!.length + 1);
    expect(patched.config.deathCauses.some((c) => c.text.includes('vending machine'))).toBe(true);
  });

  it('appends name lists that share a file name', () => {
    const base = loadBuiltins(false).content;
    const patched = loadBuiltins(true).content;
    expect(patched.names.us_male.length).toBeGreaterThan(base.names.us_male.length);
    expect(patched.names.us_male).toContain('Kai');
  });

  it('orders by dependencies regardless of list order', () => {
    const mods = available(coreMod(), exampleMod());
    const res = loadContent(mods, [
      { id: 'example', enabled: true },
      { id: 'core', enabled: true },
    ]);
    expect(res.loaded).toEqual(['core', 'example']);
  });

  it('skips mods whose dependency is disabled', () => {
    const mods = available(coreMod(), exampleMod());
    const res = loadContent(mods, [
      { id: 'core', enabled: false },
      { id: 'example', enabled: true },
    ]);
    expect(res.loaded).toEqual([]);
    expect(res.errors.some((e) => e.mod === 'example' && /disabled/.test(e.message))).toBe(true);
  });

  it('reports bad expressions and missing fields instead of crashing', () => {
    const bad = mod({
      'mod.json': JSON.stringify({ id: 'bad', name: 'Bad', version: '1', dependencies: ['core'] }),
      'events/x.yaml': '- id: broken\n  text: hi\n  when: "age >"\n- id: no_text\n',
      'patches/p.yaml': '- type: careers\n  id: core:nope\n  op: merge\n  value: {}\n',
    });
    const mods = available(coreMod(), bad);
    const res = loadContent(mods, mods.map((m) => ({ id: m.manifest.id, enabled: true })));
    const msgs = res.errors.map((e) => e.message).join('\n');
    expect(msgs).toMatch(/bad:broken/);
    expect(msgs).toMatch(/missing text/);
    expect(msgs).toMatch(/not found/);
  });
});
