<script lang="ts">
  let { value, label = '', icon = '' }: { value: number; label?: string; icon?: string } = $props();
  const pct = $derived(Math.max(0, Math.min(100, Math.round(value))));
  const color = $derived(pct < 30 ? 'var(--bad)' : pct < 60 ? 'var(--ok)' : 'var(--good)');
</script>

<div class="bar-row">
  {#if label}
    <div class="bar-label"><span>{icon} {label}</span><span class="pct">{pct}%</span></div>
  {/if}
  <div class="track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <div class="fill" style:width="{pct}%" style:background={color}></div>
  </div>
</div>

<style>
  .bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    margin-bottom: 0.2rem;
  }
  .pct {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .track {
    height: 8px;
    border-radius: 99px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s ease, background 0.3s;
  }
</style>
