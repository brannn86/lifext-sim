<script lang="ts">
  import Bar from './Bar.svelte';
  import { store } from '../store.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  const stats = $derived([...store.content.stats.values()].filter((s) => s.visible));
</script>

<div class="stats" class:compact>
  {#each stats as s (s.id)}
    <Bar value={store.life?.stats[s.id] ?? 0} label={s.label} icon={s.icon} />
  {/each}
</div>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .stats.compact {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0.9rem;
  }
  .compact :global(.bar-label) {
    font-size: 0.75rem;
    margin-bottom: 0.1rem;
  }
  .compact :global(.track) {
    height: 6px;
  }
</style>
