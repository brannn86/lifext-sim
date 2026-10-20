<script lang="ts">
  import type { Gender } from '../../engine';
  import { store } from '../store.svelte';

  const countries = $derived([...store.content.countries.values()]);

  let first = $state('');
  let last = $state('');
  let gender = $state<Gender | 'random'>('random');
  let countryId = $state('random');

  function start() {
    store.newLife({
      first,
      last,
      gender: gender === 'random' ? undefined : gender,
      countryId: countryId === 'random' ? undefined : countryId,
    });
  }
</script>

<div class="page">
  <div class="page-header">
    <button class="ghost" onclick={() => (store.screen = 'menu')} aria-label="Back">←</button>
    <h1>New Life</h1>
  </div>

  <form class="card form" onsubmit={(e) => (e.preventDefault(), start())}>
    <p class="muted small">Leave anything blank or random to let fate decide.</p>
    <div class="grid">
      <label>First name<input bind:value={first} placeholder="Random" maxlength="30" /></label>
      <label>Last name<input bind:value={last} placeholder="Random" maxlength="30" /></label>
      <label>
        Gender
        <select bind:value={gender}>
          <option value="random">🎲 Random</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </label>
      <label>
        Country
        <select bind:value={countryId}>
          <option value="random">🎲 Random</option>
          {#each countries as c (c.id)}
            <option value={c.id}>{c.flag ?? ''} {c.name}</option>
          {/each}
        </select>
      </label>
    </div>
    <button class="primary start" type="submit" disabled={!countries.length}>Be born 👶</button>
    {#if !countries.length}<p class="muted small">No countries are loaded. Check the Mods screen.</p>{/if}
  </form>
</div>

<style>
  .form {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .form p {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.9rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .start {
    padding: 0.85rem;
    font-size: 1.05rem;
  }
</style>
