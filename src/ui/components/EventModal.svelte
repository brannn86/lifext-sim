<script lang="ts">
  import { pendingChoices } from '../../engine';
  import Modal from './Modal.svelte';
  import { store } from '../store.svelte';

  const pending = $derived(store.life?.pending[0]);
  const choices = $derived(store.life && pending ? pendingChoices(store.content, store.life) : []);
</script>

{#if pending}
  <Modal title="Age {store.life?.age}">
    <p class="text">{pending.text}</p>
    <div class="stack">
      {#each choices as c (c.index)}
        <button class="choice" onclick={() => store.choose(c.index)}>{c.label}</button>
      {/each}
      {#if !choices.length}
        <!-- Every choice was filtered out by its `when`; let the player move on. -->
        <button class="primary" onclick={() => store.choose(-1)}>Continue</button>
      {/if}
    </div>
  </Modal>
{/if}

<style>
  .text {
    font-size: 1.05rem;
    margin: 0 0 1rem;
  }
  .choice {
    text-align: left;
    padding: 0.75rem 1rem;
  }
</style>
