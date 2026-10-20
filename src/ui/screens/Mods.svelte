<script lang="ts">
  import { store } from '../store.svelte';

  let fileInput: HTMLInputElement;

  const manifestOf = (id: string) => store.available.find((a) => a.manifest.id === id);

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) await store.importMod(file);
    fileInput.value = '';
  }
</script>

<div class="page">
  <div class="page-header">
    <button class="ghost" onclick={() => (store.screen = 'menu')} aria-label="Back">←</button>
    <h1 class="grow">Mods</h1>
    <input type="file" accept=".zip" bind:this={fileInput} onchange={onFile} hidden />
    <button onclick={() => fileInput.click()}>📦 Import .zip</button>
  </div>

  <p class="muted small">
    Mods load top to bottom; later mods can override and patch earlier ones. Changes apply to new lives and
    the current session after you press <strong>Apply</strong>.
  </p>

  {#if store.modsDirty}
    <div class="card dirty row">
      <span class="grow">You have unapplied changes.</span>
      <button class="primary" onclick={() => store.reloadMods()}>Apply</button>
    </div>
  {/if}

  <div class="stack">
    {#each store.settings as s, i (s.id)}
      {@const a = manifestOf(s.id)}
      {#if a}
        <div class="card mod" class:off={!s.enabled}>
          <div class="row">
            <label class="row grow toggle">
              <input type="checkbox" checked={s.enabled} disabled={s.id === 'core'} onchange={() => store.toggleMod(s.id)} />
              <div class="grow">
                <strong>{a.manifest.name}</strong>
                <span class="badge">v{a.manifest.version}</span>
                <span class="badge">{a.source.builtin ? 'built-in' : 'installed'}</span>
                {#if s.enabled && !store.loaded.includes(s.id) && !store.modsDirty}<span class="badge err">not loaded</span>{/if}
              </div>
            </label>
            {#if s.id !== 'core'}
              <button class="ghost" disabled={i <= 1} onclick={() => store.moveMod(s.id, -1)} aria-label="Move up">▲</button>
              <button class="ghost" disabled={i >= store.settings.length - 1} onclick={() => store.moveMod(s.id, 1)} aria-label="Move down">▼</button>
            {/if}
            {#if !a.source.builtin}
              <button class="ghost danger" onclick={() => confirm(`Uninstall ${a.manifest.name}?`) && store.removeMod(s.id)} aria-label="Uninstall">🗑️</button>
            {/if}
          </div>
          {#if a.manifest.description}<p class="small desc">{a.manifest.description}</p>{/if}
          <div class="muted small">
            id: <code>{a.manifest.id}</code>
            {#if a.manifest.author}· by {a.manifest.author}{/if}
            {#if a.manifest.dependencies?.length}· needs {a.manifest.dependencies.join(', ')}{/if}
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <h3>Problems</h3>
  {#if store.errors.length}
    <div class="card errors">
      {#each store.errors as e, i (i)}
        <div class="small err-line"><strong>{e.mod}</strong>{e.file ? ` / ${e.file}` : ''}: {e.message}</div>
      {/each}
    </div>
  {:else}
    <p class="muted small">✅ No problems found in the loaded mods.</p>
  {/if}

  <h3>Loaded content</h3>
  <p class="muted small">
    {store.content.events.size} events · {store.content.activities.size} activities · {store.content.careers.size} careers ·
    {store.content.countries.size} countries · {store.content.lore.size} lore entries · {store.content.stats.size} stats
  </p>
</div>

<style>
  .mod {
    padding: 0.75rem 1rem;
  }
  .mod.off {
    opacity: 0.6;
  }
  .toggle {
    cursor: pointer;
  }
  .toggle input {
    width: auto;
    transform: scale(1.2);
  }
  .desc {
    margin: 0.4rem 0;
  }
  .dirty {
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.75rem;
    border-color: var(--accent);
  }
  .errors {
    padding: 0.75rem 1rem;
    border-color: var(--bad);
  }
  .err-line + .err-line {
    margin-top: 0.35rem;
  }
  .err {
    color: var(--bad);
  }
  code {
    font-size: 0.8rem;
  }
</style>
