<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title = '', onclose, children }: { title?: string; onclose?: () => void; children: Snippet } = $props();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onclose) onclose();
  }
</script>

<svelte:window {onkeydown} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose?.()}>
  <div class="modal card" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
    {#if title}<h2>{title}</h2>{/if}
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 50;
    animation: fade 0.12s ease-out;
  }
  .modal {
    width: min(440px, 100%);
    max-height: 85dvh;
    overflow: auto;
    padding: 1.25rem;
    animation: pop 0.15s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.96);
      opacity: 0;
    }
  }
</style>
