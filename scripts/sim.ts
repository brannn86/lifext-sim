// Headless balance check: plays N lives with a simple bot and prints a report.
//   npm run sim -- 500
//
// Useful after adding or tuning content: catches runtime errors in expressions,
// shows how often each event fires, lifespan, money and ribbon distribution.

import * as E from '../src/engine';
import { builtinSources } from '../src/storage/builtinMods';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 200);

const available = builtinSources().map((source) => {
  const manifest = E.readManifest(source);
  if ('message' in manifest) throw new Error(manifest.message);
  return { manifest, source };
});
const { content, errors, loaded } = E.loadContent(available, available.map((a) => ({ id: a.manifest.id, enabled: true })));
console.log(`Mods: ${loaded.join(', ')}`);
if (errors.length) {
  console.log('Load errors:');
  for (const e of errors) console.log(`  ${e.mod}${e.file ? '/' + e.file : ''}: ${e.message}`);
}

const eventCounts = new Map<string, number>([...content.events.keys()].map((k) => [k, 0]));
const ribbons = new Map<string, number>();
const causes = new Map<string, number>();
const ages: number[] = [];
const moneys: number[] = [];
let runtimeErrors = 0;

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** A simple "reasonable player": studies, works, does a random activity. */
function botTurn(life: E.Life) {
  const rng = Math.random;
  if (life.education.current && rng() < 0.6) E.studyHarder(content, life);
  if (!life.education.current && life.age >= 18) {
    for (const { stage, eligible } of E.educationOptions(content, life)) {
      if (eligible && rng() < 0.7) E.applyToSchool(content, life, stage.id);
    }
  }
  if (!life.job && !life.education.current && life.age >= 16 && life.age < 60) {
    const jobs = E.jobListings(content, life).filter((j) => j.qualified);
    jobs.sort((a, b) => b.career.salary - a.career.salary);
    for (const j of jobs.slice(0, 3)) if (!life.job) E.applyForJob(content, life, j.career.id);
  }
  if (life.job) E.workHarder(content, life);
  if (life.job && life.age >= 65) E.retire(content, life);
  const acts = [...content.activities.values()].filter((a) => E.activityStatus(content, life, a).enabled && a.category !== 'Crime');
  const act = acts[Math.floor(rng() * acts.length)];
  if (act) E.doActivity(content, life, act.id);
  if (life.age >= 25 && !E.partnerOf(life)) E.findDate(content, life, life.gender === 'male' ? 'female' : 'male');
  const partner = E.partnerOf(life);
  if (partner?.role === 'partner' && rng() < 0.3) E.propose(content, life, partner.id);
  if (partner?.role === 'spouse' && life.age < 40 && rng() < 0.4) E.tryForBaby(content, life, partner.id);
}

for (let i = 0; i < N; i++) {
  const life = E.createLife(content, { seed: i + 1 });
  try {
    while (life.alive && life.age < 150) {
      while (life.pending.length) {
        const choices = E.pendingChoices(content, life);
        const pick = choices[Math.floor(Math.random() * choices.length)];
        E.resolveEvent(content, life, pick ? pick.index : -1);
      }
      botTurn(life);
      const r = E.ageUp(content, life);
      for (const id of r.events) bump(eventCounts, id);
    }
  } catch (e) {
    runtimeErrors++;
    if (runtimeErrors <= 5) console.error(`Life ${i + 1} crashed at age ${life.age}:`, (e as Error).message);
    continue;
  }
  ages.push(life.age);
  moneys.push(life.money);
  bump(ribbons, life.ribbonId ?? 'none');
  bump(causes, life.causeOfDeath ?? '?');
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const table = (m: Map<string, number>) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(6)}  ${k}`).join('\n');

console.log(`\nSimulated ${N} lives (${runtimeErrors} crashed)`);
console.log(`Lifespan: avg ${avg(ages).toFixed(1)}, median ${median(ages)}, min ${Math.min(...ages)}, max ${Math.max(...ages)}`);
console.log(`Money at death: avg ${Math.round(avg(moneys)).toLocaleString()}, median ${Math.round(median(moneys)).toLocaleString()}`);
console.log(`\nRibbons:\n${table(ribbons)}`);
console.log(`\nCauses of death:\n${table(causes)}`);
console.log(`\nEvent frequency (times fired across all lives):\n${table(eventCounts)}`);
const never = [...eventCounts].filter(([, v]) => v === 0).map(([k]) => k);
if (never.length) console.log(`\n⚠️  Never fired: ${never.join(', ')}`);
if (runtimeErrors) process.exitCode = 1;
