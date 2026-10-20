<script lang="ts">
  import Modal from './Modal.svelte';
  import { store } from '../store.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const life = $derived(store.life!);
  const ribbon = $derived(life.ribbonId ? store.content.ribbons.get(life.ribbonId) : undefined);
  const heirs = $derived(life.people.filter((p) => p.role === 'child' && p.alive));
  const job = $derived(life.job ? store.content.careers.get(life.job.careerId) : undefined);
  const degrees = $derived(
    life.education.completed.map((id) => store.content.education.get(id)?.name ?? id).filter(Boolean),
  );
</script>

<Modal title="🪦 Rest in peace" {onclose}>
  <p class="epitaph">
    <strong>{life.first} {life.last}</strong> died at age {life.age} from {life.causeOfDeath}.
  </p>

  {#if ribbon}
    <div class="ribbon card">
      <span class="ribbon-icon">{ribbon.icon ?? '🎗️'}</span>
      <div>
        <strong>{ribbon.name}</strong>
        <div class="muted small">{ribbon.description}</div>
      </div>
    </div>
  {/if}

  <ul class="summary small">
    <li>💰 Net worth: {store.money(life.money)}</li>
    {#if job}<li>💼 Career: {job.titles[life.job?.level ?? 0]}</li>{/if}
    {#if degrees.length}<li>🎓 Education: {degrees.join(', ')}</li>{/if}
    <li>👪 Children: {life.people.filter((p) => p.role === 'child').length}</li>
    <li>🧬 Generation {life.generation}</li>
  </ul>

  {#if heirs.length}
    <h3>Continue as your child</h3>
    <div class="stack">
      {#each heirs as h (h.id)}
        <button onclick={() => store.continueAsChild(h.id)}>
          {h.gender === 'female' ? '👧' : '👦'} {h.first} {h.last}, age {h.age}
          <span class="muted small">· inherits {store.money(Math.max(0, life.money) / heirs.length)}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="row actions">
    <button class="primary grow" onclick={() => (store.screen = 'new')}>New life</button>
    <button class="grow" onclick={onclose}>Read my story</button>
  </div>
</Modal>

<style>
  .epitaph {
    margin: 0 0 1rem;
  }
  .ribbon {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem;
    box-shadow: none;
    background: var(--accent-soft);
  }
  .ribbon-icon {
    font-size: 2rem;
  }
  .summary {
    padding-left: 1.1rem;
    margin: 1rem 0;
  }
  .actions {
    margin-top: 1rem;
  }
</style>
