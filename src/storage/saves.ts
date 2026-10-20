// Save slots in localStorage: one key per life plus a small index.

import type { Life } from '../engine/types';

const INDEX_KEY = 'lifext.saves';
const SAVE_PREFIX = 'lifext.save.';

export interface SaveMeta {
  id: string;
  name: string;
  age: number;
  alive: boolean;
  generation: number;
  savedAt: number;
}

function readIndex(): SaveMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeIndex(index: SaveMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function listSaves(): SaveMeta[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveLife(life: Life): boolean {
  try {
    localStorage.setItem(SAVE_PREFIX + life.id, JSON.stringify(life));
    const meta: SaveMeta = {
      id: life.id,
      name: `${life.first} ${life.last}`,
      age: life.age,
      alive: life.alive,
      generation: life.generation,
      savedAt: Date.now(),
    };
    writeIndex([meta, ...readIndex().filter((m) => m.id !== life.id)]);
    return true;
  } catch {
    return false;
  }
}

export function loadLife(id: string): Life | null {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + id);
    return raw ? (JSON.parse(raw) as Life) : null;
  } catch {
    return null;
  }
}

export function deleteSave(id: string) {
  try {
    localStorage.removeItem(SAVE_PREFIX + id);
    writeIndex(readIndex().filter((m) => m.id !== id));
  } catch {
    /* ignore */
  }
}
