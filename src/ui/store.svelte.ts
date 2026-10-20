// App state. The engine mutates `store.life` directly; because it's a Svelte
// $state proxy, every mutation re-renders whatever reads it.

import * as E from '../engine';
import { builtinSources } from '../storage/builtinMods';
import * as Saves from '../storage/saves';
import * as UserMods from '../storage/userMods';

export type Screen = 'menu' | 'new' | 'game' | 'mods' | 'lore' | 'saves';

export interface Popup {
  title: string;
  message: string;
}

const WIDE_QUERY = '(min-width: 900px)';

class Store {
  ready = $state(false);
  screen = $state<Screen>('menu');
  wide = $state(typeof matchMedia === 'function' ? matchMedia(WIDE_QUERY).matches : true);

  content = $state.raw<E.Content>(E.emptyContent());
  available = $state.raw<E.AvailableMod[]>([]);
  errors = $state.raw<E.ModError[]>([]);
  loaded = $state.raw<string[]>([]);
  settings = $state<E.ModSetting[]>([]);
  modsDirty = $state(false);

  life = $state<E.Life | null>(null);
  popup = $state<Popup | null>(null);
  saves = $state.raw<Saves.SaveMeta[]>([]);

  async init() {
    if (typeof matchMedia === 'function') {
      matchMedia(WIDE_QUERY).addEventListener('change', (e) => (this.wide = e.matches));
    }
    await this.reloadMods();
    this.saves = Saves.listSaves();
    this.ready = true;
  }

  // ------------------------------------------------------------------ mods --

  async reloadMods() {
    const sources = [...builtinSources(), ...(await UserMods.listUserMods())];
    const available: E.AvailableMod[] = [];
    const errors: E.ModError[] = [];
    for (const source of sources) {
      const m = E.readManifest(source);
      if ('message' in m) errors.push(m);
      else if (available.some((a) => a.manifest.id === m.id)) {
        errors.push({ mod: m.id, message: 'Another mod already uses this id; this copy was ignored.' });
      } else available.push({ manifest: m, source });
    }
    // Built-ins first, then user mods, then the saved order wins.
    this.settings = UserMods.reconcileSettings(UserMods.loadModSettings(), available.map((a) => a.manifest.id));
    UserMods.saveModSettings($state.snapshot(this.settings));
    const res = E.loadContent(available, $state.snapshot(this.settings));
    this.available = available;
    this.content = res.content;
    this.loaded = res.loaded;
    this.errors = [...errors, ...res.errors];
    this.modsDirty = false;
  }

  toggleMod(id: string) {
    const s = this.settings.find((x) => x.id === id);
    if (!s || id === 'core') return;
    s.enabled = !s.enabled;
    this.modsDirty = true;
    UserMods.saveModSettings($state.snapshot(this.settings));
  }

  moveMod(id: string, dir: -1 | 1) {
    const i = this.settings.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i <= 0 || j <= 0 || j >= this.settings.length) return; // core stays first
    [this.settings[i], this.settings[j]] = [this.settings[j], this.settings[i]];
    this.modsDirty = true;
    UserMods.saveModSettings($state.snapshot(this.settings));
  }

  async importMod(file: File) {
    try {
      const m = await UserMods.importZip(file);
      if (this.available.some((a) => a.manifest.id === m.id && a.source.builtin)) {
        await UserMods.deleteUserMod(m.id);
        throw new Error(`"${m.id}" is a built-in mod id. Change the id in mod.json.`);
      }
      await this.reloadMods();
      this.popup = { title: '📦 Mod installed', message: `${m.name} (${m.version}) was installed and enabled.` };
    } catch (e) {
      this.popup = { title: 'Import failed', message: (e as Error).message };
    }
  }

  async removeMod(id: string) {
    await UserMods.deleteUserMod(id);
    await this.reloadMods();
  }

  // ----------------------------------------------------------------- lives --

  newLife(opts: E.NewLifeOptions) {
    this.life = E.createLife(this.content, opts);
    this.screen = 'game';
    this.persist();
  }

  continueAsChild(childId: number) {
    if (!this.life) return;
    const parent = $state.snapshot(this.life) as E.Life;
    this.life = E.createChildLife(this.content, parent, childId);
    this.persist();
  }

  load(id: string) {
    const life = Saves.loadLife(id);
    if (!life) {
      this.popup = { title: 'Load failed', message: 'That save could not be read.' };
      return;
    }
    this.life = life;
    this.screen = 'game';
    const warning = this.modMismatch(life);
    if (warning) this.popup = { title: '⚠️ Mods changed', message: warning };
  }

  deleteSave(id: string) {
    Saves.deleteSave(id);
    this.saves = Saves.listSaves();
    if (this.life?.id === id) this.life = null;
  }

  /** Describes differences between the mods a life was made with and the current ones. */
  modMismatch(life: E.Life): string {
    const now = new Map(this.content.mods.map((m) => [m.id, m.version]));
    const missing = life.mods.filter((m) => !now.has(m.id)).map((m) => m.id);
    const changed = life.mods.filter((m) => now.has(m.id) && now.get(m.id) !== m.version).map((m) => m.id);
    const lines: string[] = [];
    if (missing.length) lines.push(`This life used mods that are no longer active: ${missing.join(', ')}. Their content will be skipped.`);
    if (changed.length) lines.push(`These mods changed version since this life started: ${changed.join(', ')}.`);
    return lines.join('\n');
  }

  persist() {
    if (!this.life) return;
    if (!Saves.saveLife($state.snapshot(this.life) as E.Life)) {
      this.popup = { title: 'Save failed', message: 'Browser storage is full or unavailable. Progress is not being saved.' };
    }
    this.saves = Saves.listSaves();
  }

  // --------------------------------------------------------------- actions --

  ageUp() {
    if (!this.life) return;
    E.ageUp(this.content, this.life);
    this.persist();
  }

  choose(index: number) {
    if (!this.life) return;
    const message = E.resolveEvent(this.content, this.life, index);
    if (message) this.popup = { title: '', message };
    this.persist();
  }

  /** Runs any engine action and shows its result. */
  act(fn: (content: E.Content, life: E.Life) => E.ActionResult) {
    if (!this.life) return;
    const r = fn(this.content, this.life);
    this.popup = { title: r.title ?? (r.ok ? '' : 'Not now'), message: r.message };
    if (r.ok) this.persist();
  }

  // --------------------------------------------------------------- helpers --

  money(n: number): string {
    const cur = this.life ? this.content.countries.get(this.life.countryId)?.currency ?? '$' : '$';
    const sign = n < 0 ? '-' : '';
    return `${sign}${cur}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
  }

  unlockedLore(): E.LoreDef[] {
    const ids = new Set(this.life?.lore ?? []);
    return [...this.content.lore.values()].filter((l) => l.unlocked || ids.has(l.id));
  }
}

export const store = new Store();
