import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadContent, readManifest, type AvailableMod } from '../src/engine';
import type { ModSource } from '../src/engine/types';

/** Reads a mod folder from disk (tests run in Node, not through Vite's glob). */
export function modFromDisk(dir: string): ModSource {
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files[relative(dir, p).split('\\').join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return { files, builtin: true };
}

export function available(...sources: ModSource[]): AvailableMod[] {
  return sources.map((source) => {
    const manifest = readManifest(source);
    if ('message' in manifest) throw new Error(manifest.message);
    return { manifest, source };
  });
}

export const coreMod = () => modFromDisk(join(__dirname, '..', 'mods', 'core'));
export const exampleMod = () => modFromDisk(join(__dirname, '..', 'mods', 'example-expansion'));

export function loadBuiltins(withExample = true) {
  const mods = withExample ? available(coreMod(), exampleMod()) : available(coreMod());
  return loadContent(mods, mods.map((m) => ({ id: m.manifest.id, enabled: true })));
}
