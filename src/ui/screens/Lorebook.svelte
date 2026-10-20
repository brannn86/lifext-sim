<script lang="ts">
  import LorePanel from '../panels/LorePanel.svelte';
  import { store } from '../store.svelte';
</script>

<div class="page">
  <div class="page-header">
    <button class="ghost" onclick={() => (store.screen = 'menu')} aria-label="Back">←</button>
    <h1>Lorebook</h1>
  </div>
  <p class="muted small">
    {store.life ? `Entries unlocked by ${store.life.first} ${store.life.last}, plus entries every life starts with.` : 'Entries every life starts with. Play to unlock more.'}
  </p>
  <LorePanel />
</div>
