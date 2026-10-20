<script lang="ts">
  import { store } from '../store.svelte';

  const latest = $derived(store.saves.find((s) => s.alive) ?? store.saves[0]);
  const modCount = $derived(store.loaded.length);
</script>

<div class="menu">
  <div class="hero">
    <div class="logo">🌱</div>
    <h1>Lifext Sim</h1>
    <p class="muted">Live a life, one year at a time. Make it yours with mods.</p>
  </div>

  <div class="buttons">
    {#if latest}
      <button class="primary big" onclick={() => store.load(latest.id)}>
        Continue
        <span class="sub">{latest.name} · age {latest.age}{latest.alive ? '' : ' · 💀'}</span>
      </button>
    {/if}
    <button class={latest ? 'big' : 'primary big'} onclick={() => (store.screen = 'new')}>New Life</button>
    <button onclick={() => (store.screen = 'saves')} disabled={!store.saves.length}>Saved Lives ({store.saves.length})</button>
    <button onclick={() => (store.screen = 'mods')}>
      Mods <span class="badge">{modCount} active</span>
      {#if store.errors.length}<span class="badge warn">{store.errors.length} issue{store.errors.length > 1 ? 's' : ''}</span>{/if}
    </button>
    <button onclick={() => (store.screen = 'lore')}>Lorebook</button>
  </div>
</div>

<style>
  .menu {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    gap: 2rem;
  }
  .hero {
    text-align: center;
  }
  .logo {
    font-size: 3.5rem;
  }
  h1 {
    font-size: 2.2rem;
    margin-bottom: 0.25rem;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: min(340px, 100%);
  }
  .big {
    padding: 0.9rem;
    font-size: 1.05rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .sub {
    font-size: 0.8rem;
    font-weight: 400;
    opacity: 0.85;
  }
  .warn {
    color: var(--bad);
  }
</style>
