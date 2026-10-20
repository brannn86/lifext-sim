import type { Life } from './types';

/** Append a line to the current year's log. */
export function addLog(life: Life, text: string) {
  if (!text) return;
  let year = life.log[life.log.length - 1];
  if (!year || year.age !== life.age) {
    year = { age: life.age, entries: [] };
    life.log.push(year);
  }
  year.entries.push(text);
}
