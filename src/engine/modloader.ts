// Turns raw mod files into a merged, validated Content registry.
//
// 1. read every mod.json
// 2. order enabled mods (dependencies first, then loadAfter, then user order)
// 3. for each mod: load its files into the registries, then apply its patches
// 4. validate expressions so mistakes show up on the Mods screen, not mid-game

import yaml from 'js-yaml';
import { qualify } from './context';
import { compile } from './expr';
import { parseStmt } from './effects';
import { applyPatch, registryOf, type Patch } from './patch';
import { checkText } from './text';
import type { Config, Content, LoreDef, ModError, ModManifest, ModSetting, ModSource } from './types';

export interface AvailableMod {
  manifest: ModManifest;
  source: ModSource;
}

export interface LoadResult {
  content: Content;
  errors: ModError[];
  /** Mod ids actually loaded, in load order. */
  loaded: string[];
}

const DEFAULT_CONFIG: Config = {
  startMoney: 0,
  eventsPerYear: 1,
  deathChance: 0.01,
  npcDeathChance: 0.01,
  relationshipDecay: 2,
  livingCost: 0,
  retirementAge: 60,
  pensionRate: 0.4,
  deathCauses: [],
};

/** Required fields per content type (beyond `id`). */
const REQUIRED: Record<string, string[]> = {
  stats: ['label'],
  countries: ['name', 'currency', 'names'],
  events: ['text'],
  activities: ['label', 'category'],
  education: ['name', 'years'],
  careers: ['name', 'salary', 'titles'],
  interactions: ['label', 'targets'],
  ribbons: ['name', 'when'],
};

export function emptyContent(): Content {
  return {
    mods: [],
    config: structuredClone(DEFAULT_CONFIG),
    stats: new Map(),
    countries: new Map(),
    names: {},
    events: new Map(),
    activities: new Map(),
    education: new Map(),
    careers: new Map(),
    interactions: new Map(),
    ribbons: new Map(),
    lore: new Map(),
  };
}

export function readManifest(source: ModSource): ModManifest | ModError {
  const raw = source.files['mod.json'];
  if (raw === undefined) return { mod: '?', message: 'Missing mod.json' };
  try {
    const m = JSON.parse(raw) as ModManifest;
    if (!m.id || !/^[a-z0-9_-]+$/i.test(m.id)) return { mod: '?', file: 'mod.json', message: 'mod.json needs an "id" (letters, numbers, - and _)' };
    return { ...m, name: m.name ?? m.id, version: m.version ?? '0.0.0' };
  } catch (e) {
    return { mod: '?', file: 'mod.json', message: `Invalid JSON: ${(e as Error).message}` };
  }
}

/** Dependency-aware load order. Mods with missing deps are skipped with an error. */
export function resolveOrder(mods: Map<string, ModManifest>, settings: ModSetting[], errors: ModError[]): string[] {
  const enabled = new Set(settings.filter((s) => s.enabled && mods.has(s.id)).map((s) => s.id));
  const order: string[] = [];
  const state = new Map<string, 'visiting' | 'done' | 'bad'>();

  const visit = (id: string): boolean => {
    const st = state.get(id);
    if (st === 'done') return true;
    if (st === 'bad') return false;
    if (st === 'visiting') {
      errors.push({ mod: id, message: 'Circular dependency' });
      return false;
    }
    state.set(id, 'visiting');
    const m = mods.get(id)!;
    for (const dep of m.dependencies ?? []) {
      if (!enabled.has(dep)) {
        errors.push({ mod: id, message: `Requires "${dep}", which is ${mods.has(dep) ? 'disabled' : 'not installed'}. Mod skipped.` });
        state.set(id, 'bad');
        return false;
      }
      if (!visit(dep)) {
        errors.push({ mod: id, message: `Dependency "${dep}" failed to load. Mod skipped.` });
        state.set(id, 'bad');
        return false;
      }
    }
    for (const after of m.loadAfter ?? []) {
      if (enabled.has(after) && state.get(after) !== 'visiting') visit(after);
    }
    state.set(id, 'done');
    order.push(id);
    return true;
  };

  for (const s of settings) if (enabled.has(s.id)) visit(s.id);
  return order;
}

export function loadContent(available: AvailableMod[], settings: ModSetting[]): LoadResult {
  const errors: ModError[] = [];
  const content = emptyContent();
  const byId = new Map(available.map((a) => [a.manifest.id, a]));
  const order = resolveOrder(new Map(available.map((a) => [a.manifest.id, a.manifest])), settings, errors);

  for (const id of order) {
    const { manifest, source } = byId.get(id)!;
    content.mods.push({ id, name: manifest.name, version: manifest.version });
    loadMod(content, id, source, errors);
  }
  validateConfig(content, errors);
  return { content, errors, loaded: order };
}

function loadMod(content: Content, modId: string, source: ModSource, errors: ModError[]) {
  const patches: { patch: Patch; file: string }[] = [];
  const paths = Object.keys(source.files).sort();

  for (const file of paths) {
    const text = source.files[file];
    const err = (message: string) => errors.push({ mod: modId, file, message });
    try {
      if (file === 'mod.json') continue;
      if (file.startsWith('names/') && file.endsWith('.txt')) {
        const key = file.slice('names/'.length, -'.txt'.length);
        const names = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
        content.names[key] = [...(content.names[key] ?? []), ...names];
      } else if (file.startsWith('lore/') && file.endsWith('.md')) {
        const lore = parseLore(text, file, modId);
        content.lore.set(lore.id, lore);
      } else if (/\.ya?ml$/.test(file)) {
        const type = file.split('/')[0].replace(/\.ya?ml$/, '');
        const data = yaml.load(text);
        if (data == null) continue;
        if (type === 'config') {
          if (typeof data !== 'object' || Array.isArray(data)) err('config must be a mapping');
          else Object.assign(content.config, data);
        } else if (type === 'patches') {
          for (const patch of asList(data, err)) patches.push({ patch: patch as Patch, file });
        } else if (registryOf(content, type)) {
          for (const item of asList(data, err)) register(content, type, item, modId, err);
        } else {
          err(`Unknown content type "${type}" (file ignored)`);
        }
      }
    } catch (e) {
      err((e as Error).message);
    }
  }

  for (const { patch, file } of patches) {
    const res = applyPatch(content, patch, modId);
    if (res.error) errors.push({ mod: modId, file, message: res.error });
    if (res.touched) {
      const def = registryOf(content, patch.type)?.get(res.touched);
      if (def) checkDef(def, (m) => errors.push({ mod: modId, file, message: `${res.touched}: ${m}` }));
    }
  }
}

function asList(data: unknown, err: (m: string) => void): unknown[] {
  if (Array.isArray(data)) return data;
  err('Expected a list (each entry starts with "- ")');
  return [];
}

function register(content: Content, type: string, item: unknown, modId: string, err: (m: string) => void) {
  if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
    err(`Every ${type} entry needs an "id"`);
    return;
  }
  const def = item as Record<string, unknown> & { id: string };
  def.id = type === 'stats' ? def.id : qualify(def.id, modId);
  def.mod = modId;
  const missing = (REQUIRED[type] ?? []).filter((k) => def[k] === undefined);
  if (missing.length) {
    err(`${def.id}: missing ${missing.join(', ')}`);
    return;
  }
  if (type === 'careers' && (!Array.isArray(def.titles) || !def.titles.length)) {
    err(`${def.id}: titles must be a non-empty list`);
    return;
  }
  checkDef(def, (m) => err(`${def.id}: ${m}`));
  registryOf(content, type)!.set(def.id, def);
}

const EXPR_KEYS = ['when', 'requires', 'weight', 'cost', 'acceptChance', 'costPerYear', 'applyChance', 'start', 'drift'];

/** Syntax-checks every expression, effect and text template in a definition. */
export function checkDef(def: Record<string, any>, report: (m: string) => void) {
  const tryIt = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      report((e as Error).message);
    }
  };
  for (const k of EXPR_KEYS) if (typeof def[k] === 'string') tryIt(() => compile(def[k]));
  for (const v of Object.values(def.vars ?? {})) if (typeof v === 'string') tryIt(() => compile(v));
  for (const eff of def.effects ?? []) tryIt(() => parseStmt(String(eff)));
  for (const k of ['text', 'label']) if (typeof def[k] === 'string') checkText(def[k]).forEach(report);
  for (const nested of [...(def.outcomes ?? []), ...(def.choices ?? [])]) {
    if (nested && typeof nested === 'object') checkDef(nested, report);
  }
}

function validateConfig(content: Content, errors: ModError[]) {
  const c = content.config;
  for (const k of ['eventsPerYear', 'deathChance', 'npcDeathChance', 'relationshipDecay', 'livingCost'] as const) {
    if (typeof c[k] === 'string') {
      try {
        compile(c[k] as string);
      } catch (e) {
        errors.push({ mod: 'config', message: `${k}: ${(e as Error).message}` });
      }
    }
  }
  for (const cause of c.deathCauses ?? []) checkDef(cause as any, (m) => errors.push({ mod: 'config', message: `deathCauses: ${m}` }));
  if (!content.countries.size) errors.push({ mod: 'config', message: 'No countries defined; at least one is required.' });
}

/** Lore files: optional YAML front matter between `---` lines, then Markdown. */
export function parseLore(text: string, file: string, modId: string): LoreDef {
  let meta: Record<string, unknown> = {};
  let body = text;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (m) {
    meta = (yaml.load(m[1]) as Record<string, unknown>) ?? {};
    body = m[2];
  }
  const base = file.split('/').pop()!.replace(/\.md$/, '');
  return {
    id: qualify(String(meta.id ?? base), modId),
    mod: modId,
    title: String(meta.title ?? base),
    body: body.trim(),
    unlocked: meta.unlocked === true,
    category: meta.category ? String(meta.category) : undefined,
  };
}
