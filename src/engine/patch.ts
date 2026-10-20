// Patches let one mod change another mod's content without copying it.
//
//   - type: careers
//     id: core:doctor
//     op: merge            # merge | replace | remove | append | set
//     value: { salary: 150000 }

import { qualify } from './context';
import type { Content } from './types';

export interface Patch {
  type: string;
  id?: string;
  op: 'merge' | 'replace' | 'remove' | 'append' | 'set';
  path?: string;
  value?: unknown;
  /** Don't report an error if the target doesn't exist (e.g. optional mod). */
  optional?: boolean;
}

export const REGISTRY_TYPES = [
  'stats',
  'countries',
  'events',
  'activities',
  'education',
  'careers',
  'interactions',
  'ribbons',
  'lore',
] as const;
export type RegistryType = (typeof REGISTRY_TYPES)[number];

export function registryOf(content: Content, type: string): Map<string, any> | undefined {
  return (REGISTRY_TYPES as readonly string[]).includes(type)
    ? (content[type as RegistryType] as Map<string, any>)
    : undefined;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Objects merge recursively; arrays and primitives replace. */
export function deepMerge(target: Record<string, unknown>, value: unknown) {
  if (!isObj(value)) return;
  for (const [k, v] of Object.entries(value)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (isObj(v) && isObj(target[k])) deepMerge(target[k] as Record<string, unknown>, v);
    else target[k] = v;
  }
}

function walk(target: Record<string, unknown>, path: string, create: boolean) {
  const keys = path.split('.');
  const last = keys.pop()!;
  let obj: Record<string, unknown> = target;
  for (const k of keys) {
    if (!isObj(obj[k])) {
      if (!create) return null;
      obj[k] = {};
    }
    obj = obj[k] as Record<string, unknown>;
  }
  return { obj, last };
}

/** Applies a patch. Returns `error` on failure and the patched id as `touched`. */
export function applyPatch(content: Content, patch: Patch, modId: string): { error?: string; touched?: string } {
  if (!patch || typeof patch !== 'object') return { error: 'Patch must be an object' };
  let reg: Map<string, any> | undefined;
  let id = '';
  let target: Record<string, unknown>;
  if (patch.type === 'config') {
    if (patch.op !== 'merge' && patch.op !== 'append' && patch.op !== 'set') {
      return { error: 'Config patches support merge, append and set' };
    }
    target = content.config;
  } else {
    reg = registryOf(content, patch.type);
    if (!reg) return { error: `Unknown patch type "${patch.type}"` };
    if (!patch.id) return { error: 'Patch needs an id' };
    id = patch.type === 'stats' ? patch.id : qualify(patch.id, modId);
    target = reg.get(id);
    if (!target && patch.op !== 'replace') {
      return patch.optional ? {} : { error: `Patch target ${patch.type} "${id}" not found` };
    }
  }
  const touched = id || undefined;
  switch (patch.op) {
    case 'merge':
      deepMerge(target, patch.value);
      return { touched };
    case 'replace':
      if (!isObj(patch.value)) return { error: 'replace needs an object value' };
      reg!.set(id, { ...patch.value, id, mod: modId });
      return { touched };
    case 'remove':
      reg!.delete(id);
      return {};
    case 'append': {
      if (!patch.path) return { error: 'append needs a path' };
      const w = walk(target, patch.path, true)!;
      const arr = Array.isArray(w.obj[w.last]) ? (w.obj[w.last] as unknown[]) : [];
      arr.push(...(Array.isArray(patch.value) ? patch.value : [patch.value]));
      w.obj[w.last] = arr;
      return { touched };
    }
    case 'set': {
      if (!patch.path) return { error: 'set needs a path' };
      const w = walk(target, patch.path, true)!;
      w.obj[w.last] = patch.value;
      return { touched };
    }
  }
  return { error: `Unknown patch op "${(patch as Patch).op}"` };
}
