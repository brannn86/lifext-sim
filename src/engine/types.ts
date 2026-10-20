// Shared types for the engine. Everything here is plain JSON-serialisable data,
// so a Life can be saved with JSON.stringify and content can come from YAML.

/** An expression string (see expr.ts) or a literal number. */
export type NumExpr = number | string;

// ---------------------------------------------------------------- mods ----

export interface ModManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** Mods that must be loaded (and enabled) before this one. */
  dependencies?: string[];
  /** Mods that should load before this one if present (soft ordering). */
  loadAfter?: string[];
}

/** Raw files of one mod, keyed by path relative to the mod folder. */
export interface ModSource {
  files: Record<string, string>;
  builtin: boolean;
}

export interface ModSetting {
  id: string;
  enabled: boolean;
}

export interface ModError {
  mod: string;
  file?: string;
  message: string;
}

// ------------------------------------------------------------- content ----

/** Fields every registry entry gets after loading. */
export interface Def {
  /** Fully qualified id, e.g. "core:doctor". */
  id: string;
  /** Id of the mod that defined (or last replaced) this entry. */
  mod: string;
}

export interface Outcome {
  weight?: NumExpr;
  when?: string;
  text?: string;
  effects?: string[];
}

export interface StatDef {
  /** Stats are NOT namespaced: `stats.happiness` reads better in expressions. */
  id: string;
  mod: string;
  label: string;
  icon?: string;
  visible?: boolean;
  min?: number;
  max?: number;
  start?: NumExpr;
  /** Evaluated once per year; the result is added to the stat. */
  drift?: NumExpr;
}

export interface CountryDef extends Def {
  name: string;
  currency: string;
  flag?: string;
  names: { male: string; female: string; last: string };
}

export interface EventChoice extends Outcome {
  label: string;
  /** Pick one of these at random (weighted) instead of using effects/text. */
  outcomes?: Outcome[];
}

export interface EventDef extends Def {
  text: string;
  minAge?: number;
  maxAge?: number;
  weight?: NumExpr;
  when?: string;
  /** Fire at most once per life. */
  once?: boolean;
  /** Named values computed when the event fires, usable in text and effects. */
  vars?: Record<string, NumExpr>;
  effects?: string[];
  outcomes?: Outcome[];
  choices?: EventChoice[];
}

export interface ActivityDef extends Def {
  label: string;
  category: string;
  icon?: string;
  description?: string;
  minAge?: number;
  maxAge?: number;
  when?: string;
  cost?: NumExpr;
  /** Default true: usable once per year. */
  oncePerYear?: boolean;
  text?: string;
  effects?: string[];
  outcomes?: Outcome[];
}

export interface EducationDef extends Def {
  name: string;
  years: number;
  /** Auto stages enrol by themselves at startAge (e.g. primary school). */
  auto?: boolean;
  startAge?: number;
  /** For applied stages: minimum age to apply. */
  minAge?: number;
  requires?: string;
  /** Percent chance of acceptance (applied stages). */
  acceptChance?: NumExpr;
  costPerYear?: NumExpr;
}

export interface CareerDef extends Def {
  name: string;
  category?: string;
  icon?: string;
  minAge?: number;
  maxAge?: number;
  requires?: string;
  /** Human-readable requirement summary shown in the UI. */
  requirementText?: string;
  /** Percent chance of being hired when requirements are met. */
  applyChance?: NumExpr;
  salary: number;
  /** Salary multiplier added per promotion level (default 0.3). */
  raise?: number;
  /** Promotion ladder; titles[0] is the starting title. */
  titles: string[];
}

export interface InteractionDef extends Def {
  label: string;
  /** Roles this can target: parent, sibling, partner, spouse, child, friend, ex. */
  targets: string[];
  minAge?: number;
  when?: string;
  cost?: NumExpr;
  text?: string;
  effects?: string[];
  outcomes?: Outcome[];
}

export interface RibbonDef extends Def {
  name: string;
  icon?: string;
  description?: string;
  when: string;
  priority?: number;
}

export interface LoreDef extends Def {
  title: string;
  body: string;
  unlocked?: boolean;
  category?: string;
}

export interface DeathCause {
  text: string;
  when?: string;
  weight?: NumExpr;
}

export interface Config {
  startMoney: number;
  startYear?: number;
  eventsPerYear: NumExpr;
  deathChance: NumExpr;
  npcDeathChance: NumExpr;
  relationshipDecay: NumExpr;
  /** Yearly expenses (rent, food, taxes). Never pushes money below 0 on its own. */
  livingCost: NumExpr;
  retirementAge: number;
  pensionRate: number;
  deathCauses: DeathCause[];
  [key: string]: unknown;
}

export interface Content {
  mods: { id: string; name: string; version: string }[];
  config: Config;
  stats: Map<string, StatDef>;
  countries: Map<string, CountryDef>;
  names: Record<string, string[]>;
  events: Map<string, EventDef>;
  activities: Map<string, ActivityDef>;
  education: Map<string, EducationDef>;
  careers: Map<string, CareerDef>;
  interactions: Map<string, InteractionDef>;
  ribbons: Map<string, RibbonDef>;
  lore: Map<string, LoreDef>;
}

// ---------------------------------------------------------------- life ----

export type Gender = 'male' | 'female';
export type Role = 'parent' | 'sibling' | 'partner' | 'spouse' | 'child' | 'friend' | 'ex';

export interface Person {
  id: number;
  first: string;
  last: string;
  gender: Gender;
  age: number;
  role: Role;
  relationship: number;
  alive: boolean;
  looks: number;
  smarts: number;
  causeOfDeath?: string;
}

export interface JobState {
  careerId: string;
  level: number;
  performance: number;
  years: number;
  levelYears: number;
}

export interface EducationState {
  current: { stageId: string; year: number; grades: number } | null;
  completed: string[];
}

export interface PendingEvent {
  eventId: string;
  text: string;
  vars: Record<string, number | string | boolean>;
}

export interface LogYear {
  age: number;
  entries: string[];
}

export interface Life {
  version: 1;
  id: string;
  seed: number;
  /** Current PRNG state; advances on every random roll. */
  rng: number;
  generation: number;
  first: string;
  last: string;
  gender: Gender;
  countryId: string;
  birthYear: number;
  age: number;
  alive: boolean;
  causeOfDeath?: string;
  ribbonId?: string;
  money: number;
  pension: number;
  stats: Record<string, number>;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  people: Person[];
  nextPersonId: number;
  job: JobState | null;
  education: EducationState;
  /** Keys of once-per-year actions already used this year. */
  usedThisYear: string[];
  /** Ids of `once: true` events that already fired. */
  firedOnce: string[];
  /** Unlocked lore ids. */
  lore: string[];
  pending: PendingEvent[];
  log: LogYear[];
  /** Mods active when this life was created. */
  mods: { id: string; version: string }[];
}

/** What every player action returns to the UI. */
export interface ActionResult {
  ok: boolean;
  title?: string;
  message: string;
}
