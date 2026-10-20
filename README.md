# 🌱 Lifext Sim

A moddable, BitLife-style life simulator. Live a life one year at a time, make choices, build a career and a family, die, and continue as your child.

**Everything in the game is data.** Stats, events, careers, activities, countries, names, ribbons and lore all live in plain YAML, text and Markdown files inside `mods/`. The base game is itself just a mod called `core`. Anything it does, your mod can do too, and your mod can change anything `core` defines.

> Status: **prototype**. The architecture is complete; the content is deliberately small.

---

## Contents

1. [Quick start](#quick-start)
2. [How to play](#how-to-play)
3. [How it works](#how-it-works)
4. [Making a mod](#making-a-mod)
5. [Content reference](#content-reference)
6. [Expression language](#expression-language)
7. [Effects](#effects)
8. [Text templates](#text-templates)
9. [Patches](#patches)
10. [Saves, versions and mod changes](#saves-versions-and-mod-changes)
11. [Mobile and packaging](#mobile-and-packaging)
12. [Project layout](#project-layout)
13. [Roadmap](#roadmap)

---

## Quick start

Requires **Node.js 20+**.

```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # unit tests (expression language, mod loader, simulation)
npm run sim -- 500 # simulate 500 lives headlessly and print a balance report
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

The build in `dist/` is fully static and uses relative paths, so you can open it from any web host or folder.

---

## How to play

| Where | What |
|---|---|
| **Main menu** | Continue your latest life, start a new one, browse saves, manage mods, read the lorebook. |
| **New Life** | Choose a name, gender and country, or leave them blank/random. |
| **＋ Age** | Advance one year. Stats drift, people age, school and jobs progress, random events happen, and you might die. On desktop you can also press **Space** or **Enter**. |
| **Event pop-ups** | Some events ask you to choose. You can't age up until you do. |
| **🎯 Activities** | Gym, library, doctor, vacation, lottery, crime… Most can be done **once per year**. Greyed-out buttons tell you why (too poor, already done). |
| **💼 Work & School** | Study harder, apply to university or medical school, apply for jobs, work harder for promotions, retire. |
| **👥 People** | Make friends, date, propose, have kids, and interact with family. Relationships decay if you ignore people. |
| **📖 Lore** | Lorebook entries you've unlocked. |

The game **autosaves** after every action. When you die you get a summary and a **ribbon** (e.g. *Rich*, *Saint*, *Rebel*), and you can **continue as one of your children**. They inherit an equal share of your money.

**Layout:** on desktop (≥900px wide) you get three columns: you and your stats, the life story, and the action tabs. On phones it becomes a single column with a bottom tab bar; tabs open as a sliding sheet.

---

## How it works

```
mods/*  ──►  Mod loader  ──►  Content registry  ──►  Engine  ◄──►  UI (Svelte)
 (YAML,      order, parse,     Maps of events,       pure TS,        reads/mutates
  txt, md)   patch, validate   careers, stats…       no DOM          the Life object
```

### The engine (`src/engine/`)

The engine is pure TypeScript with no DOM access. It runs the same in the browser, in tests, and in the headless simulator.

- **A Life is one JSON object** (`types.ts → Life`): stats, money, flags, counters, people, job, education, log, pending events and the RNG state. Saving a life is just `JSON.stringify`.
- **Seeded RNG** (`rng.ts`): every random roll advances `life.rng`. The same seed plus the same choices gives the same life, which makes bugs reproducible.
- **Content is data** (`types.ts → Content`): one `Map` per content type, keyed by namespaced id (`core:doctor`).

### The yearly tick (`tick.ts → ageUp`)

When you press **Age**, this happens in order:

1. `age += 1`, and per-year action limits reset.
2. **Stat drift**: each stat's `drift` expression is added (e.g. health declines after 45).
3. **People**: everyone ages, may die (`config.npcDeathChance`), relationships decay (`config.relationshipDecay`), and neglected partners may leave.
4. **Education**: grades move toward your smarts, the year counter advances, graduation happens, and new automatic stages (primary, secondary) enrol you at their `startAge`.
5. **Job**: the career ends if you're past its `maxAge`. Otherwise salary is paid, performance drifts, and you may be promoted (performance ≥ 75 after 2+ years at a level) or fired (performance < 20).
6. **Pension** is paid if you're retired, then **living costs** (`config.livingCost`) are paid.
7. **Random events**: `config.eventsPerYear` events are drawn by weighted random from those whose `minAge`/`maxAge`/`when` match. Events without choices apply immediately. Events with choices are queued as pop-ups.
8. **Death check**: health ≤ 0, or a roll against `config.deathChance`. On death, a cause is picked from `config.deathCauses` and a ribbon is awarded.

### How stats affect outcomes

Almost every check is a **weighted random roll whose weights or chances are expressions over your stats**. For example, the science fair "win" outcome has `weight: "stats.smarts"` against a fixed `weight: 50` for failing, so a smart kid wins most of the time. Job offers use `applyChance` (a percent), dating success compares your looks to your date's, and so on. Because the formulas live in the mod files, you can rebalance the whole game without touching code.

**Balancing tip:** run `npm run sim -- 500` after changes. A bot plays 500 lives (always studying and chasing the best-paid job). The report shows lifespan, money, ribbon spread, causes of death, how often each event fires, and any event that never fires.

### Mod loading (`modloader.ts`)

1. Read every mod's `mod.json`.
2. Work out the load order. The user's order on the Mods screen is the default, but `dependencies` always load first and `loadAfter` is respected when present. A mod whose dependency is missing or disabled is skipped, with an error.
3. Load each mod's files into the registries, then apply **that mod's patches**.
4. Syntax-check every expression, effect and text template. Problems are listed on the **Mods screen** instead of crashing the game.

Built-in mods (`mods/*`) are bundled at build time. User mods are imported as `.zip` files and stored in the browser's IndexedDB.

---

## Making a mod

The fastest way to learn is to read **`mods/example-expansion/`**. It uses every feature:

```
mods/example-expansion/
  mod.json              # identity + dependencies
  countries.yaml        # adds Japan
  names/jp_*.txt        # name lists for Japan
  names/us_male.txt     # ADDS names to core's US list (same file name)
  careers.yaml          # Shrine Keeper (only in Japan, needs good karma)
  events/japan.yaml     # new events; one unlocks lore
  lore/hanami.md        # a lorebook entry
  patches/core.yaml     # changes core: doctor salary, an extra wallet choice,
                        # a new death cause, a new condition on the flu event
```

### Step by step

**1. Create a folder** with a `mod.json`:

```json
{
  "id": "pirates",
  "name": "Pirate Life",
  "version": "1.0.0",
  "author": "You",
  "description": "Arr.",
  "dependencies": ["core"]
}
```

`id` uses letters, numbers, `-` and `_`. It becomes the **namespace** for everything you define: an event `id: mutiny` becomes `pirates:mutiny`.

**2. Add content files.** The **first folder or file name** decides the content type:

| Path | Type |
|---|---|
| `config.yaml` | global rules (merged over core's) |
| `stats.yaml` | stats |
| `countries.yaml` | countries |
| `events.yaml` or `events/*.yaml` | random events |
| `activities.yaml` or `activities/*.yaml` | activities |
| `education.yaml` | schools |
| `careers.yaml` | jobs |
| `interactions.yaml` | things you can do with people |
| `ribbons.yaml` | end-of-life ribbons |
| `patches.yaml` or `patches/*.yaml` | changes to other mods |
| `names/<list>.txt` | one name per line (`#` starts a comment) |
| `lore/<id>.md` | lorebook entries |

Every YAML content file is a **list**:

```yaml
- id: parrot
  text: A parrot landed on your shoulder and refuses to leave.
  minAge: 8
  once: true
  effects: ["stats.happiness += 5", "flag has_parrot"]
```

**3. Install it.**
- **As a built-in mod (development):** put the folder in `mods/` and restart `npm run dev`. It shows up on the Mods screen automatically.
- **As a user mod:** zip the folder (with `mod.json` at the root of the zip, or inside one top-level folder). In the game, open **Mods → 📦 Import .zip**. Only text files (`.json .yaml .yml .txt .md`) are read.

**4. Check the Mods screen.** Any syntax error, missing field or failed patch appears under **Problems**, with the mod and file it came from. Then run `npm run sim -- 300` to see how often your events fire and whether anything crashes.

### Overriding vs patching

- **Same id = replace.** If your mod defines `id: core:doctor` in `careers.yaml`, it replaces core's doctor entirely.
- **Patches = surgical changes.** Use `patches/*.yaml` to tweak one field, append a choice, or remove something. See [Patches](#patches).
- **Name lists append.** A `names/us_male.txt` in your mod adds names to core's list.

---

## Content reference

Fields marked *expr* take a number or an [expression](#expression-language) string. Fields marked *effects* take a list of [effect statements](#effects). Every `text` and `label` is a [template](#text-templates).

### Shared: outcomes

`activities`, `interactions`, events and event choices can all have **outcomes**. The runner applies `effects` and `text` first, then picks **one** outcome by weight:

```yaml
outcomes:
  - weight: "stats.athleticism"   # expr; default 1
    when: "age >= 18"             # optional; outcome skipped if false
    effects: [...]
    text: You won!
  - weight: 50
    text: You lost.
```

### `config.yaml`

| Field | Meaning |
|---|---|
| `startMoney` | money at birth |
| `startYear` | birth year of new lives (default: the real current year) |
| `eventsPerYear` | *expr*: random events per year |
| `deathChance` | *expr*, 0..1: yearly chance the player dies |
| `npcDeathChance` | *expr*, 0..1: same for other people (only `age` is in scope) |
| `relationshipDecay` | *expr*: relationship points lost per person per year |
| `livingCost` | *expr*: yearly expenses (rent, food, taxes, lifestyle). It only spends money you have; it never pushes you into debt by itself |
| `retirementAge` | minimum age to retire |
| `pensionRate` | pension = final salary × this |
| `deathCauses` | list of `{ text, when?, weight? }` |

### `stats.yaml`

```yaml
- id: happiness        # NOT namespaced: read as stats.happiness
  label: Happiness
  icon: "😊"
  visible: true        # shown as a bar; hidden stats still work in expressions
  min: 0               # default 0
  max: 100             # default 100
  start: "rand(60, 100)"   # expr, at birth
  drift: "rand(-3, 2)"     # expr, added every year
```

Add a stat in your mod and it automatically appears in the UI (if `visible`) and in every life.

### `countries.yaml`

```yaml
- id: japan
  name: Japan
  flag: "🇯🇵"
  currency: "¥"
  names: { male: jp_male, female: jp_female, last: jp_last }   # names/*.txt
```

### `events`

```yaml
- id: found_wallet
  text: "You found a wallet with {currency}{fmt(amount)} inside."
  minAge: 6            # optional
  maxAge: 90           # optional
  weight: 1            # expr; relative frequency
  when: "!has('in_jail')"   # expr; must be true to fire
  once: true           # optional; at most once per life
  vars:                # computed when the event fires; usable as {amount} and in effects
    amount: "rand(20, 300)"
  effects: [...]       # for events WITHOUT choices: applied immediately
  outcomes: [...]      # for events WITHOUT choices: one is picked
  choices:             # makes it a pop-up
    - label: Keep it
      when: "true"         # optional; hide the choice if false
      effects: ["money += amount", "stats.karma -= 5"]
      text: You pocketed the cash.
      outcomes: [...]      # optional
```

### `activities.yaml`

```yaml
- id: gym
  label: Go to the gym
  category: Mind & Body   # groups buttons in the UI; any name works
  icon: "🏋️"
  minAge: 12
  maxAge: 90
  when: "!has('injured')" # hidden when false
  cost: 0                 # expr; paid up front; button disabled if you can't afford it
  oncePerYear: true       # default true
  effects: [...]
  text: You worked out.
  outcomes: [...]
```

### `education.yaml`

```yaml
- id: primary
  name: Primary School
  auto: true          # enrols automatically at startAge
  startAge: 6
  years: 6
  requires: "true"    # expr

- id: university
  name: University
  minAge: 17          # can apply from this age (Work & School tab)
  years: 4
  requires: "completed('secondary')"
  acceptChance: "clamp(stats.smarts * 1.2 - 10, 5, 95)"   # expr, percent
  costPerYear: 8000   # expr
```

### `careers.yaml`

```yaml
- id: programmer
  name: Programmer
  category: Tech
  icon: "💻"
  minAge: 18
  maxAge: 70                         # can't be hired after this; the job also ends past it
  requires: "completed('university') && stats.smarts >= 50"   # expr
  requirementText: University degree, smarts 50+               # shown in the UI
  applyChance: "stats.smarts - 10"   # expr, percent (default 60)
  salary: 70000                      # per year at level 0
  raise: 0.3                         # +30% salary per promotion (default)
  titles: [Junior Developer, Developer, Senior Developer, Lead Developer, CTO]
```

### `interactions.yaml`

These appear when you tap a person in the People tab. Inside them, `npc` is that person.

```yaml
- id: gift
  label: Give a gift
  targets: [partner, spouse, parent, friend, child, sibling, ex]   # roles
  minAge: 12
  when: "npc.age >= 5"     # expr
  cost: 100                # expr
  effects: ["npc.relationship += rand(5, 12)"]
  text: "You gave {npc.first} a gift. {cap(npc.he)} loved it."
```

### `ribbons.yaml`

At death, the matching ribbon with the **highest `priority`** wins.

```yaml
- id: rich
  name: Rich
  icon: "💰"
  description: Died with a fortune.
  when: "money >= 1000000"
  priority: 50
```

### `lore/*.md`

```markdown
---
id: old_town          # optional; defaults to the file name
title: Old Town
category: Places      # optional; shown as a badge
unlocked: true        # optional; unlocked from the start in every life
---
**Old Town** is where every family begins...
```

Unlock an entry from any effect with `unlock old_town`. Lore bodies support headings, paragraphs, lists, `**bold**`, `*italic*` and `` `code` ``. HTML is escaped.

---

## Expression language

Expressions are short formulas in strings. They are **parsed, never `eval`'d**, and they can only read the values listed below. A mod cannot run arbitrary code.

```yaml
when: "age >= 18 && stats.smarts > 60 && !has('criminal_record')"
weight: "if(stats.health < 30, 5, 1)"
```

**Operators:** `+ - * / %`, `== != < <= > >=`, `&& || !` (or `and or not`), parentheses. `+` joins strings. Division by zero gives 0.

**Values:** numbers, `"strings"` or `'strings'`, `true`, `false`, `null`. A missing value reads as nothing (`undefined`), and in arithmetic it counts as 0.

### What you can read

| Name | Meaning |
|---|---|
| `age`, `year`, `money`, `generation` | numbers |
| `name`, `first`, `last`, `gender` | `gender` is `"male"`/`"female"` |
| `country`, `countryName`, `currency` | `country` is the id, e.g. `"core:us"` |
| `stats.<id>` | any stat, e.g. `stats.karma` |
| `flags.<name>` | true/false |
| `counters.<name>` | numbers you've counted |
| `job` | `null`, or `{ id, name, title, category, level, performance, years, salary }` |
| `education` | `{ current, grades, completed }` (`current` is a stage id or `null`) |
| `partner` | your partner/spouse (same fields as `npc`) or `null` |
| `npc` | in interactions: `{ name, first, last, gender, age, role, title, relationship, looks, smarts, he, him, his }` |
| `he`, `him`, `his` | the player's pronouns |
| event `vars` | by name, e.g. `amount` |

### Functions

| Function | Result |
|---|---|
| `rand(a, b)` | random integer from a to b inclusive |
| `random()` | random number 0..1 |
| `chance(p)` | true with **p percent** probability |
| `pick(a, b, c…)` | one of the arguments at random |
| `if(cond, a, b)` | `a` if cond, else `b` (only the chosen branch runs) |
| `min`, `max`, `clamp(x, lo, hi)`, `abs`, `floor`, `ceil`, `round`, `pow(x, y)` | math |
| `fmt(n)` | `1234567` → `"1,234,567"` |
| `cap(s)` | capitalise the first letter |
| `has('flag')` | is a flag set |
| `counter('name')` | a counter's value (0 if unset) |
| `count('role')` | living people with that role: `parent sibling partner spouse child friend ex` |
| `hasJob()`, `inSchool()` | true/false |
| `completed('stage')` | finished a school stage (unprefixed ids use your mod's namespace) |
| `hasLore('id')` | lore entry unlocked |

---

## Effects

Effects are a list of statements, run in order:

```yaml
effects:
  - "stats.happiness += rand(2, 6)"  # += -= *= =  (stats are clamped to min..max)
  - "money -= 500"
  - "counters.crimes += 1"
  - "flag criminal_record"           # set a flag
  - "unflag has_dog"                 # clear a flag
  - "unlock old_town"                # unlock a lore entry (adds a log line)
  - "log 'You feel lucky.'"          # add a line to the life story
  - "die 'a shark attack'"           # the player dies
  - "vars.loot = rand(10, 120)"      # temporary value; text can show it as {loot}
  - "npc.relationship += 5"          # interactions only
  - "job.performance += 10"          # if employed
  - "education.grades -= 5"          # if in school
```

You can assign to `money`, `stats.*`, `counters.*`, `flags.*`, `vars.*`, `npc.relationship`, `job.performance` and `education.grades`. Everything else is read-only, so the engine keeps its own invariants.

Text is filled in **after** effects run, so a value stored in `vars` can be shown:

```yaml
effects: ["vars.prize = rand(20, 500)", "money += vars.prize"]
text: "You won {currency}{fmt(prize)}."
```

---

## Text templates

Any `{...}` inside `text` or `label` is evaluated as an expression:

```yaml
text: "{first}, your {npc.title} {npc.first} gave you {currency}{fmt(gift)}. {cap(npc.he)} smiled."
```

If a placeholder has an error it's left as-is, so you can spot it in game.

---

## Patches

Patches change content from other mods (or from your own mod's earlier files) **without copying it**. They run after the rest of your mod's files are loaded.

```yaml
# patches/core.yaml
- type: careers          # stats, countries, events, activities, education,
  id: core:doctor        # careers, interactions, ribbons, lore, or config
  op: merge              # see below
  value: { salary: 150000 }

- type: events
  id: core:found_wallet
  op: append
  path: choices
  value:
    label: Donate it to charity
    effects: ["stats.karma += 8"]

- type: events
  id: core:flu
  op: set
  path: when
  value: "!has('lucky_charm') || chance(30)"

- type: activities
  id: core:shoplift
  op: remove

- type: config
  op: append
  path: deathCauses
  value: { text: a falling vending machine, weight: 1 }
```

| op | Does |
|---|---|
| `merge` | deep-merge `value` into the entry (objects merge, lists and values replace) |
| `replace` | replace the whole entry with `value` (creates it if missing) |
| `remove` | delete the entry |
| `append` | add `value` (or each item of a list) to the list at `path` |
| `set` | set the field at `path` (dotted, e.g. `names.male`) to `value` |

`config` supports `merge`, `append` and `set`. Add `optional: true` to a patch to silently skip it when the target doesn't exist, for example when patching a mod that may not be installed (use `loadAfter` in `mod.json` to make sure it loads first).

---

## Saves, versions and mod changes

- Lives are saved in the browser's **localStorage** (`lifext.save.<id>`), with an index under `lifext.saves`. Saving happens automatically after every action.
- User mods are stored in **IndexedDB** (`lifext` database). The enabled/order settings are in localStorage (`lifext.modSettings`).
- Each life records which mods and versions it started with. If you load a life after disabling or updating a mod, you get a warning. Content that no longer exists is skipped safely: a missing career ends your job, a missing school stage ends your enrolment, and missing events simply stop firing.
- Changing mods on the Mods screen takes effect after **Apply**. It's safest to start a new life after big mod changes.

---

## Mobile and packaging

The UI is responsive today: a single column, bottom tabs, a sliding sheet for actions, and safe-area padding for notches. It works in any mobile browser.

To ship it as an **Android/iOS app**, wrap the static build with [Capacitor](https://capacitorjs.com):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Lifext Sim" com.example.lifext --web-dir dist
npm run build && npx cap add android && npx cap sync
npx cap open android
```

The build already uses relative paths (`base: './'`), and mods import through the system file picker, which works on Android without storage permissions. For a desktop app, [Tauri](https://tauri.app) works the same way with `dist/`.

---

## Project layout

```
mods/
  core/                  the base game, as a mod
  example-expansion/     demo of every modding feature
src/
  engine/                pure TypeScript game engine (no DOM)
    types.ts             all data types (Life, Content, defs)
    expr.ts              expression tokenizer/parser/evaluator
    effects.ts           effect statements
    text.ts              {template} filling
    context.ts           what expressions can see + helper functions
    rng.ts               seeded PRNG
    modloader.ts         load order, parsing, validation
    patch.ts             patch operations
    life.ts              new life / continue as child
    tick.ts              the yearly pipeline + events
    actions.ts           activities, school, jobs, relationships
    death.ts             death roll, ribbons
    outcomes.ts          shared effects/text/outcomes runner
  storage/               localStorage saves, IndexedDB user mods, bundled mods
  ui/                    Svelte 5 UI (store, screens, panels, components)
scripts/sim.ts           headless simulator / balance report
tests/                   Vitest tests
```

**Adding engine features:** keep the engine free of DOM code, add new data fields to `types.ts`, expose new read-only values in `context.ts → scopeOf`, new functions in `context.ts → helpers`, and new writable targets in `effects.ts → assign`. Then document them here.

---

## Roadmap

Things the architecture is ready for but the prototype doesn't include yet:

- **Script hooks (tier 3 modding):** sandboxed Lua (via `wasmoon`) for mods that need real logic (`onAgeUp`, `onDeath`, custom mini-games).
- **More data-driven systems:** prison, assets (houses and cars), fame and social media, pets, illnesses, adoption, emigration.
- **Data-driven relationship actions:** dating, proposing and having babies are engine actions today; they could become content with "spawn person" effects.
- **Mod browser** and JSON Schemas for editor autocomplete.
- **Localisation:** text keys plus per-language string files in mods.
- **Currency scaling:** salaries and prices are the same numbers in every country (only the symbol changes), so a yen salary looks tiny. A per-country money multiplier would fix this.
