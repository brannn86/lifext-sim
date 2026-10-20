// Public engine API. The engine is pure TypeScript (no DOM), so it runs the
// same in the browser, in tests and in the headless simulator.

export * from './types';
export * from './actions';
export { ageUp, pendingChoices, resolveEvent, fireEvent, type TickReport } from './tick';
export { createLife, createChildLife, type NewLifeOptions } from './life';
export { loadContent, readManifest, emptyContent, type AvailableMod, type LoadResult } from './modloader';
export { pickRibbon, kill } from './death';
export { jobView, personTitle, personView } from './context';
export { evaluate, compile, ExprError } from './expr';
