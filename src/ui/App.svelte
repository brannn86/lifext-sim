<script lang="ts">
  import { store } from './store.svelte';
  import Modal from './components/Modal.svelte';
  import Menu from './screens/Menu.svelte';
  import NewLife from './screens/NewLife.svelte';
  import Game from './screens/Game.svelte';
  import Mods from './screens/Mods.svelte';
  import Saves from './screens/Saves.svelte';
  import Lorebook from './screens/Lorebook.svelte';
</script>

{#if !store.ready}
  <div class="loading">🌱 Loading…</div>
{:else if store.screen === 'menu'}
  <Menu />
{:else if store.screen === 'new'}
  <NewLife />
{:else if store.screen === 'game' && store.life}
  <Game />
{:else if store.screen === 'mods'}
  <Mods />
{:else if store.screen === 'saves'}
  <Saves />
{:else if store.screen === 'lore'}
  <Lorebook />
{:else}
  <Menu />
{/if}

{#if store.popup}
  <Modal title={store.popup.title} onclose={() => (store.popup = null)}>
    <p class="popup-text">{store.popup.message}</p>
    <button class="primary" onclick={() => (store.popup = null)}>OK</button>
  </Modal>
{/if}

<style>
  .loading {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 1.2rem;
    color: var(--muted);
  }
  .popup-text {
    white-space: pre-line;
    margin: 0 0 1rem;
  }
</style>
