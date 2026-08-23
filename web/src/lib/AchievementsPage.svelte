<script>
  import { onMount } from 'svelte';
  import { fetchAchievements } from './api.js';

  export let onBack = () => {};

  let badges = [];
  let errorMessage = '';
  let loading = true;

  async function load() {
    loading = true;
    errorMessage = '';
    try {
      badges = await fetchAchievements();
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  $: earnedCount = badges.filter((b) => b.earned).length;
</script>

<button class="back" type="button" on:click={onBack}>← 목록으로</button>

<div class="header-row">
  <h2>🎖️ 달성 기록</h2>
  {#if !loading && badges.length > 0}
    <span class="progress">{earnedCount} / {badges.length}개 획득</span>
  {/if}
</div>

{#if errorMessage}
  <p class="error">✗ {errorMessage}</p>
{/if}

{#if loading}
  <p class="loading">도장판을 펼치는 중...</p>
{:else}
  <div class="grid">
    {#each badges as badge (badge.id)}
      <div class="badge" class:earned={badge.earned} title={badge.description}>
        <span class="ring" aria-hidden="true"></span>
        <span class="emoji">{badge.emoji}</span>
        <span class="badge-title">{badge.title}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 4px 2px 12px;
    margin-bottom: 4px;
    font-family: var(--font-hand);
    font-size: 16px;
    color: var(--ink-soft);
    transition: color 0.15s ease, transform 0.15s ease;
  }

  .back:hover {
    color: var(--ink);
    transform: translateX(-2px);
  }

  .header-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 21px;
  }

  .progress {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-soft);
  }

  .error {
    color: var(--red);
    font-size: 14px;
  }

  .loading {
    color: var(--ink-soft);
    text-align: center;
    padding: 40px 0;
    font-family: var(--font-hand);
    font-size: 18px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 16px;
  }

  .badge {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--card);
    padding: 10px;
    text-align: center;
    filter: grayscale(1);
    opacity: 0.45;
    transition: filter 0.3s ease, opacity 0.3s ease, transform 0.15s ease;
  }

  .badge:hover {
    transform: translateY(-2px);
  }

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px dashed var(--card-border);
  }

  .badge.earned {
    filter: grayscale(0);
    opacity: 1;
  }

  .badge.earned .ring {
    border: 3px double var(--gold);
  }

  .emoji {
    font-size: 34px;
    line-height: 1;
  }

  .badge-title {
    font-family: var(--font-hand);
    font-size: 12px;
    color: var(--ink);
    line-height: 1.2;
  }
</style>
