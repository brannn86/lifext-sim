// User-installed mods: imported from .zip files and kept in IndexedDB.
// Also stores the enabled/disabled + order settings for all mods.

import JSZip from 'jszip';
import { readManifest } from '../engine/modloader';
import type { ModManifest, ModSetting, ModSource } from '../engine/types';

const DB = 'lifext';
const STORE = 'mods';
const SETTINGS_KEY = 'lifext.modSettings';
const TEXT_FILE = /\.(json|ya?ml|txt|md)$/i;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listUserMods(): Promise<ModSource[]> {
  try {
    const rows = await tx<{ id: string; files: Record<string, string> }[]>('readonly', (s) => s.getAll());
    return rows.map((r) => ({ files: r.files, builtin: false }));
  } catch {
    return [];
  }
}

export async function deleteUserMod(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

/** Reads a mod zip. mod.json may be at the root or inside one top folder. */
export async function importZip(file: Blob): Promise<ModManifest> {
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const manifestPath = paths
    .filter((p) => p === 'mod.json' || p.endsWith('/mod.json'))
    .sort((a, b) => a.split('/').length - b.split('/').length)[0];
  if (!manifestPath) throw new Error('No mod.json found in the zip.');
  const prefix = manifestPath.slice(0, -'mod.json'.length);

  const files: Record<string, string> = {};
  for (const p of paths) {
    if (!p.startsWith(prefix) || !TEXT_FILE.test(p) || p.includes('__MACOSX')) continue;
    files[p.slice(prefix.length)] = await zip.files[p].async('string');
  }
  const manifest = readManifest({ files, builtin: false });
  if ('message' in manifest) throw new Error(manifest.message);
  await tx('readwrite', (s) => s.put({ id: manifest.id, files }));
  return manifest;
}

export function loadModSettings(): ModSetting[] {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveModSettings(settings: ModSetting[]) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings last for this session only */
  }
}

/** Keeps the saved order, appends newly found mods (enabled), drops removed ones. Core stays first. */
export function reconcileSettings(saved: ModSetting[], ids: string[]): ModSetting[] {
  const known = new Set(ids);
  const out = saved.filter((s) => known.has(s.id));
  for (const id of ids) if (!out.some((s) => s.id === id)) out.push({ id, enabled: true });
  const core = out.findIndex((s) => s.id === 'core');
  if (core > 0) out.unshift(...out.splice(core, 1));
  if (core >= 0) out[0].enabled = true;
  return out;
}
