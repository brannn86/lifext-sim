<script lang="ts">
  import * as E from '../../engine';
  import Bar from '../components/Bar.svelte';
  import { store } from '../store.svelte';

  const life = $derived(store.life!);
  const blocked = $derived(!life.alive || life.pending.length > 0);
  let openId = $state<number | null>(null);

  const GROUPS: { label: string; roles: E.Role[] }[] = [
    { label: 'Partner', roles: ['spouse', 'partner'] },
    { label: 'Family', roles: ['parent', 'sibling'] },
    { label: 'Children', roles: ['child'] },
    { label: 'Friends', roles: ['friend'] },
    { label: 'Exes', roles: ['ex'] },
  ];

  const groups = $derived(
    GROUPS.map((g) => ({ ...g, people: life.people.filter((p) => p.alive && g.roles.includes(p.role)) })).filter(
      (g) => g.people.length,
    ),
  );
  const deceased = $derived(life.people.filter((p) => !p.alive));
  const partner = $derived(E.partnerOf(life));

  function avatar(p: E.Person) {
    const f = p.gender === 'female';
    if (p.age < 3) return '👶';
    if (p.age < 13) return f ? '👧' : '👦';
    if (p.age < 60) return f ? '👩' : '👨';
    return f ? '👵' : '👴';
  }
</script>

<h3>Meet people</h3>
<div class="action-list">
  <button class="action-btn" disabled={blocked || life.age < 5 || life.usedThisYear.includes('friend')} onclick={() => store.act(E.makeFriend)}>
    <span>🤝 Make a friend</span>
    <span class="sub">{life.age < 5 ? 'Too young' : life.usedThisYear.includes('friend') ? 'Done this year' : 'Once a year'}</span>
  </button>
  {#if life.age >= 16 && !partner}
    <button class="action-btn" disabled={blocked || life.usedThisYear.includes('date')} onclick={() => store.act((c, l) => E.findDate(c, l, 'female'))}>
      <span>💘 Date women</span><span class="sub">Find a girlfriend</span>
    </button>
    <button class="action-btn" disabled={blocked || life.usedThisYear.includes('date')} onclick={() => store.act((c, l) => E.findDate(c, l, 'male'))}>
      <span>💘 Date men</span><span class="sub">Find a boyfriend</span>
    </button>
  {/if}
</div>

{#each groups as g (g.label)}
  <h3>{g.label}</h3>
  <div class="stack">
    {#each g.people as p (p.id)}
      {@const open = openId === p.id}
      <div class="card person" class:open>
        <button class="person-head ghost" aria-expanded={open} onclick={() => (openId = open ? null : p.id)}>
          <span class="pav">{avatar(p)}</span>
          <span class="grow left">
            <strong>{p.first} {p.last}</strong>
            <span class="muted small"> · {E.personTitle(p)} · {p.age}</span>
          </span>
          <span class="rel small" title="Relationship">{p.relationship}%</span>
        </button>
        {#if open}
          <div class="person-body">
            <Bar value={p.relationship} label="Relationship" icon="❤️" />
            <div class="action-list">
              {#each E.interactionsFor(store.content, life, p) as { def, done } (def.id)}
                <button class="action-btn" disabled={blocked || done} onclick={() => store.act((c, l) => E.interact(c, l, p.id, def.id))}>
                  <span>{def.label}</span>
                  {#if done}<span class="sub">Done this year</span>{/if}
                </button>
              {/each}
              {#if p.role === 'partner' && life.age >= 18}
                <button class="action-btn" disabled={blocked || life.usedThisYear.includes('propose')} onclick={() => store.act((c, l) => E.propose(c, l, p.id))}>
                  <span>💍 Propose</span>
                </button>
              {/if}
              {#if (p.role === 'partner' || p.role === 'spouse') && life.age >= 18}
                <button class="action-btn" disabled={blocked || life.usedThisYear.includes('baby')} onclick={() => store.act((c, l) => E.tryForBaby(c, l, p.id))}>
                  <span>🍼 Try for a baby</span>
                </button>
                <button class="action-btn danger" disabled={blocked} onclick={() => confirm(`${p.role === 'spouse' ? 'Divorce' : 'Break up with'} ${p.first}?`) && store.act((c, l) => E.breakUp(c, l, p.id))}>
                  <span>💔 {p.role === 'spouse' ? 'Divorce' : 'Break up'}</span>
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/each}

{#if deceased.length}
  <h3>In memory</h3>
  {#each deceased as p (p.id)}
    <div class="small muted">🕊️ {p.first} {p.last} ({E.personTitle(p)}), died at {p.age}</div>
  {/each}
{/if}

<style>
  .person {
    box-shadow: none;
    overflow: hidden;
  }
  .person-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border-radius: 0;
    padding: 0.55rem 0.75rem;
  }
  .left {
    text-align: left;
  }
  .pav {
    font-size: 1.4rem;
  }
  .rel {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .person-body {
    padding: 0.25rem 0.75rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
</style>
