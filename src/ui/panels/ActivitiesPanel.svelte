<script lang="ts">
  import { activityStatus, doActivity, type ActivityDef } from '../../engine';
  import { store } from '../store.svelte';

  const groups = $derived.by(() => {
    const life = store.life!;
    const out = new Map<string, { def: ActivityDef; status: ReturnType<typeof activityStatus> }[]>();
    for (const def of store.content.activities.values()) {
      const status = activityStatus(store.content, life, def);
      if (!status.visible) continue;
      if (!out.has(def.category)) out.set(def.category, []);
      out.get(def.category)!.push({ def, status });
    }
    return [...out.entries()];
  });

  const blocked = $derived(!store.life?.alive || !!store.life?.pending.length);
</script>

{#if !groups.length}
  <p class="muted">Nothing to do yet. Grow up a little!</p>
{/if}

{#each groups as [category, items] (category)}
  <h3>{category}</h3>
  <div class="action-list">
    {#each items as { def, status } (def.id)}
      <button
        class="action-btn"
        disabled={blocked || !status.enabled}
        title={def.description ?? ''}
        onclick={() => store.act((c, l) => doActivity(c, l, def.id))}>
        <span>{def.icon ?? '•'} {def.label}</span>
        <span class="sub">
          {#if !status.enabled && status.reason}{status.reason}{:else if status.cost > 0}{store.money(status.cost)}{:else}Free{/if}
        </span>
      </button>
    {/each}
  </div>
{/each}
