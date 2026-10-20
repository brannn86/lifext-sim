<script lang="ts">
  import { store } from '../store.svelte';

  const fmtDate = (t: number) => new Date(t).toLocaleString();
</script>

<div class="page">
  <div class="page-header">
    <button class="ghost" onclick={() => (store.screen = 'menu')} aria-label="Back">←</button>
    <h1>Saved Lives</h1>
  </div>

  {#if !store.saves.length}
    <p class="muted">No saved lives yet.</p>
  {/if}

  <div class="stack">
    {#each store.saves as s (s.id)}
      <div class="card save row">
        <div class="grow">
          <strong>{s.alive ? '🙂' : '💀'} {s.name}</strong>
          <div class="muted small">Age {s.age} · Generation {s.generation} · {fmtDate(s.savedAt)}</div>
        </div>
        <button class="primary" onclick={() => store.load(s.id)}>Open</button>
        <button
          class="danger"
          onclick={() => confirm(`Delete ${s.name}? This can't be undone.`) && store.deleteSave(s.id)}
          aria-label="Delete">🗑️</button>
      </div>
    {/each}
  </div>
</div>

<style>
  .save {
    padding: 0.75rem 1rem;
  }
</style>
