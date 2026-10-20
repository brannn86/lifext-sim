<script lang="ts">
  import { renderMarkdown } from '../markdown';
  import { store } from '../store.svelte';

  let openId = $state<string | null>(null);

  const entries = $derived.by(() => {
    return store.unlockedLore();
  });
  const total = $derived(store.content.lore.size);
</script>

<p class="muted small">{entries.length} of {total} entries discovered.</p>

<div class="stack">
  {#each entries as l (l.id)}
    {@const open = openId === l.id}
    <div class="card entry">
      <button class="ghost head" aria-expanded={open} onclick={() => (openId = open ? null : l.id)}>
        <span class="grow">📖 {l.title}</span>
        {#if l.category}<span class="badge">{l.category}</span>{/if}
      </button>
      {#if open}
        <!-- renderMarkdown escapes all HTML in the source. -->
        <div class="body">{@html renderMarkdown(l.body)}</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .entry {
    box-shadow: none;
    overflow: hidden;
  }
  .head {
    width: 100%;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    text-align: left;
    border-radius: 0;
  }
  .body {
    padding: 0 0.9rem 0.6rem;
  }
  .body :global(p) {
    margin: 0.4rem 0;
  }
</style>
