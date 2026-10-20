<script lang="ts">
  import { tick } from 'svelte';
  import { store } from '../store.svelte';

  let el: HTMLDivElement;
  const log = $derived(store.life?.log ?? []);
  const size = $derived(log.length * 1000 + (log[log.length - 1]?.entries.length ?? 0));

  // Keep the newest year in view whenever something is logged.
  $effect(() => {
    void size;
    tick().then(() => el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  });
</script>

<div class="log" bind:this={el} aria-live="polite">
  {#each log as year (year.age)}
    <section class="year">
      <div class="age">Age {year.age}</div>
      {#if year.entries.length}
        {#each year.entries as entry, i (i)}
          <p>{entry}</p>
        {/each}
      {:else}
        <p class="muted">A quiet year.</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .log {
    overflow-y: auto;
    padding: 0.5rem 1rem 1rem;
    flex: 1;
    min-height: 0;
  }
  .year {
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--border);
  }
  .age {
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.2rem;
  }
  p {
    margin: 0.15rem 0;
  }
</style>
