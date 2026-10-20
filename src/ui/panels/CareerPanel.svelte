<script lang="ts">
  import * as E from '../../engine';
  import Bar from '../components/Bar.svelte';
  import { store } from '../store.svelte';

  const life = $derived(store.life!);
  const content = $derived(store.content);
  const blocked = $derived(!life.alive || life.pending.length > 0);

  const school = $derived(life.education.current ? content.education.get(life.education.current.stageId) : undefined);
  const job = $derived(E.jobView(content, life));
  const schools = $derived.by(() => {
    return E.educationOptions(content, life);
  });
  const listings = $derived.by(() => {
    return E.jobListings(content, life).filter((l) => l.career.id !== life.job?.careerId);
  });
  const completed = $derived(life.education.completed.map((id) => content.education.get(id)?.name ?? id));
  const canRetire = $derived(!!life.job && life.age >= content.config.retirementAge);
</script>

<h3>Education</h3>
{#if school && life.education.current}
  <div class="card box">
    <div class="row">
      <strong class="grow">🏫 {school.name}</strong>
      <span class="badge">Year {life.education.current.year + 1} of {school.years}</span>
    </div>
    <Bar value={life.education.current.grades} label="Grades" icon="📝" />
    <div class="row buttons">
      <button disabled={blocked || life.usedThisYear.includes('study')} onclick={() => store.act(E.studyHarder)}>📚 Study harder</button>
      <button class="ghost danger" disabled={blocked} onclick={() => confirm('Drop out of school?') && store.act(E.dropOut)}>Drop out</button>
    </div>
  </div>
{:else}
  <p class="muted small">{life.age < 6 ? "You're too young for school." : 'Not in school.'}</p>
{/if}
{#if completed.length}
  <p class="small muted">🎓 Completed: {completed.join(', ')}</p>
{/if}
{#if schools.length}
  <div class="action-list">
    {#each schools as { stage, eligible } (stage.id)}
      <button class="action-btn" disabled={blocked || !eligible} onclick={() => store.act((c, l) => E.applyToSchool(c, l, stage.id))}>
        <span>✉️ Apply: {stage.name}</span>
        <span class="sub">
          {stage.years} yrs{stage.costPerYear ? ` · ${store.money(Number(stage.costPerYear) || 0)}/yr` : ''}{eligible ? '' : ' · not eligible'}
        </span>
      </button>
    {/each}
  </div>
{/if}

<h3>Job</h3>
{#if job}
  <div class="card box">
    <div class="row">
      <strong class="grow">💼 {job.title}</strong>
      <span class="badge">{store.money(job.salary)}/yr</span>
    </div>
    <Bar value={job.performance} label="Performance" icon="📊" />
    <div class="row buttons">
      <button disabled={blocked || life.usedThisYear.includes('work')} onclick={() => store.act(E.workHarder)}>💪 Work harder</button>
      {#if canRetire}<button disabled={blocked} onclick={() => store.act(E.retire)}>🏖️ Retire</button>{/if}
      <button class="ghost danger" disabled={blocked} onclick={() => confirm('Quit your job?') && store.act(E.quitJob)}>Quit</button>
    </div>
  </div>
{:else}
  <p class="muted small">{life.flags.retired ? `Retired · pension ${store.money(life.pension)}/yr` : 'No job.'}</p>
{/if}

<h3>Job listings</h3>
{#if !listings.length}
  <p class="muted small">No jobs available at your age.</p>
{/if}
<div class="action-list">
  {#each listings as { career, qualified, applied } (career.id)}
    <button
      class="action-btn"
      disabled={blocked || applied}
      onclick={() => store.act((c, l) => E.applyForJob(c, l, career.id))}>
      <span>{career.icon ?? '💼'} {career.name}</span>
      <span class="sub">
        {store.money(career.salary)}/yr
        {#if applied}· applied{:else if !qualified}· needs {career.requirementText ?? 'more'}{/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .box {
    padding: 0.75rem;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .buttons {
    flex-wrap: wrap;
  }
</style>
