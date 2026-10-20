// Built-in mods are the folders under /mods, bundled into the app at build time.

import type { ModSource } from '../engine/types';

const raw = import.meta.glob('/mods/**/*.{json,yaml,yml,txt,md}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function builtinSources(): ModSource[] {
  const byFolder = new Map<string, ModSource>();
  for (const [path, text] of Object.entries(raw)) {
    // "/mods/core/events/teen.yaml" -> folder "core", file "events/teen.yaml"
    const [, , folder, ...rest] = path.split('/');
    if (!folder || !rest.length) continue;
    let src = byFolder.get(folder);
    if (!src) byFolder.set(folder, (src = { files: {}, builtin: true }));
    src.files[rest.join('/')] = text;
  }
  return [...byFolder.values()];
}
