<script lang="ts">
  import { jobView } from '../../engine';
  import { store } from '../store.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  const life = $derived(store.life!);
  const country = $derived(store.content.countries.get(life.countryId));

  const avatar = $derived.by(() => {
    const f = life.gender === 'female';
    if (!life.alive) return '🪦';
    if (life.age < 3) return '👶';
    if (life.age < 13) return f ? '👧' : '👦';
    if (life.age < 60) return f ? '👩' : '👨';
    return f ? '👵' : '👴';
  });

  const status = $derived.by(() => {
    const job = jobView(store.content, life);
    if (job) return `${job.title}`;
    const cur = life.education.current;
    if (cur) return `${store.content.education.get(cur.stageId)?.name ?? 'Student'}`;
    if (life.flags.retired) return 'Retired';
    if (life.age < 6) return 'Child';
    return 'Unemployed';
  });
</script>

<div class="who" class:compact>
  <div class="avatar" aria-hidden="true">{avatar}</div>
  <div class="grow">
    <div class="name">{life.first} {life.last}</div>
    <div class="muted small">
      {country?.flag ?? ''} Age {life.age} · {status}
    </div>
  </div>
  <div class="money" class:neg={life.money < 0} title="Bank balance">{store.money(life.money)}</div>
</div>

<style>
  .who {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .avatar {
    font-size: 2.6rem;
    line-height: 1;
    width: 3.2rem;
    height: 3.2rem;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    border-radius: 50%;
  }
  .compact .avatar {
    font-size: 1.7rem;
    width: 2.4rem;
    height: 2.4rem;
  }
  .name {
    font-weight: 700;
    font-size: 1.05rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .money {
    font-weight: 700;
    color: var(--good);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .money.neg {
    color: var(--bad);
  }
</style>
