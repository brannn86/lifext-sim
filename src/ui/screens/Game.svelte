<script lang="ts">
  import CharacterCard from '../components/CharacterCard.svelte';
  import DeathModal from '../components/DeathModal.svelte';
  import EventModal from '../components/EventModal.svelte';
  import LifeLog from '../components/LifeLog.svelte';
  import StatBars from '../components/StatBars.svelte';
  import ActivitiesPanel from '../panels/ActivitiesPanel.svelte';
  import CareerPanel from '../panels/CareerPanel.svelte';
  import LorePanel from '../panels/LorePanel.svelte';
  import PeoplePanel from '../panels/PeoplePanel.svelte';
  import { store } from '../store.svelte';

  type Tab = 'activities' | 'career' | 'people' | 'lore';
  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'activities', label: 'Activities', icon: '🎯' },
    { id: 'career', label: 'Work & School', icon: '💼' },
    { id: 'people', label: 'People', icon: '👥' },
    { id: 'lore', label: 'Lore', icon: '📖' },
  ];

  let tab = $state<Tab>('activities');
  let sheetOpen = $state(false);
  let deathDismissed = $state(false);

  const life = $derived(store.life!);
  const blocked = $derived(!life.alive || life.pending.length > 0);

  // Show the death summary again whenever a new life dies.
  $effect(() => {
    if (life.alive) deathDismissed = false;
  });

  function openTab(t: Tab) {
    tab = t;
    if (!store.wide) sheetOpen = true;
  }

  function onkeydown(e: KeyboardEvent) {
    // Space / Enter on the page (not in a field or button) ages up: handy on desktop.
    const target = e.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
    if ((e.key === ' ' || e.key === 'Enter') && !blocked && !store.popup) {
      e.preventDefault();
      store.ageUp();
    }
  }
</script>

<svelte:window {onkeydown} />

{#snippet panel()}
  {#if tab === 'activities'}<ActivitiesPanel />
  {:else if tab === 'career'}<CareerPanel />
  {:else if tab === 'people'}<PeoplePanel />
  {:else}<LorePanel />{/if}
{/snippet}

{#snippet ageButton()}
  <div class="age-bar">
    {#if life.alive}
      <button class="primary age-btn" disabled={blocked} onclick={() => store.ageUp()}>
        <span class="plus">＋</span> Age
        <span class="sub">{life.age} → {life.age + 1}</span>
      </button>
    {:else}
      <button class="primary age-btn" onclick={() => (deathDismissed = false)}>🪦 Life summary</button>
    {/if}
  </div>
{/snippet}

<div class="game" class:wide={store.wide}>
  {#if store.wide}
    <aside class="left">
      <div class="card side">
        <CharacterCard />
        <hr />
        <StatBars />
      </div>
      <button class="ghost menu-btn" onclick={() => (store.screen = 'menu')}>☰ Main menu</button>
    </aside>

    <main class="center card">
      <LifeLog />
      {@render ageButton()}
    </main>

    <aside class="right card">
      <div class="tabs" role="tablist">
        {#each TABS as t (t.id)}
          <button role="tab" aria-selected={tab === t.id} class:active={tab === t.id} onclick={() => openTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        {/each}
      </div>
      <div class="panel">{@render panel()}</div>
    </aside>
  {:else}
    <header class="mobile-top card">
      <div class="row">
        <button class="ghost icon" onclick={() => (store.screen = 'menu')} aria-label="Main menu">☰</button>
        <div class="grow"><CharacterCard compact /></div>
      </div>
      <StatBars compact />
    </header>

    <main class="mobile-log">
      <LifeLog />
    </main>

    {@render ageButton()}

    <nav class="bottom-tabs">
      {#each TABS as t (t.id)}
        <button class:active={sheetOpen && tab === t.id} onclick={() => openTab(t.id)}>
          <span class="tab-icon">{t.icon}</span>
          <span class="tab-label">{t.label}</span>
        </button>
      {/each}
    </nav>

    {#if sheetOpen}
      <div class="sheet-backdrop" role="presentation" onclick={() => (sheetOpen = false)}></div>
      <section class="sheet card" aria-label={TABS.find((t) => t.id === tab)?.label}>
        <div class="sheet-head row">
          <strong class="grow">{TABS.find((t) => t.id === tab)?.icon} {TABS.find((t) => t.id === tab)?.label}</strong>
          <button class="ghost" onclick={() => (sheetOpen = false)} aria-label="Close">✕</button>
        </div>
        <div class="panel">{@render panel()}</div>
      </section>
    {/if}
  {/if}
</div>

{#if !store.popup}
  <EventModal />
{/if}
{#if !life.alive && !deathDismissed && !store.popup}
  <DeathModal onclose={() => (deathDismissed = true)} />
{/if}

<style>
  .game {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* ---------- desktop: three columns ---------- */
  .game.wide {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 380px;
    gap: 1rem;
    padding: 1rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  .left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
  }
  .side {
    padding: 1rem;
  }
  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1rem 0;
  }
  .menu-btn {
    align-self: flex-start;
    color: var(--muted);
  }
  .center {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .right {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    border: none;
    border-radius: 0;
    background: transparent;
    padding: 0.6rem 0.25rem;
    font-size: 0.78rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    color: var(--muted);
    border-bottom: 2px solid transparent;
  }
  .tabs button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .panel {
    overflow-y: auto;
    padding: 1rem;
    flex: 1;
    min-height: 0;
  }

  .age-bar {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .age-btn {
    width: 100%;
    padding: 0.85rem;
    font-size: 1.15rem;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .plus {
    font-size: 1.3rem;
  }
  .sub {
    font-size: 0.85rem;
    font-weight: 400;
    opacity: 0.8;
  }

  /* ---------- mobile: single column + bottom tabs ---------- */
  .mobile-top {
    border-radius: 0 0 var(--radius) var(--radius);
    border-top: none;
    padding: 0.6rem 0.75rem 0.75rem;
    padding-top: max(0.6rem, env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .icon {
    padding: 0.4rem 0.6rem;
    font-size: 1.1rem;
  }
  .mobile-log {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .bottom-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .bottom-tabs button {
    border: none;
    border-radius: 0;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.45rem 0.2rem;
    color: var(--muted);
  }
  .bottom-tabs button.active {
    color: var(--accent);
  }
  .tab-icon {
    font-size: 1.25rem;
  }
  .tab-label {
    font-size: 0.7rem;
  }
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 35%);
    z-index: 20;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 82dvh;
    z-index: 21;
    border-radius: 18px 18px 0 0;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom);
    animation: slide 0.18s ease-out;
  }
  .sheet-head {
    padding: 0.75rem 1rem 0.25rem;
  }
  @keyframes slide {
    from {
      transform: translateY(30%);
      opacity: 0;
    }
  }
</style>
