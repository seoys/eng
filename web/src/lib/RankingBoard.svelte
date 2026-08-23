<script>
  import { onMount } from 'svelte';
  import { fetchWeeklyRanking } from './api.js';

  export let myUserId;

  let ranking = [];
  let errorMessage = '';

  async function load() {
    try {
      ranking = await fetchWeeklyRanking();
    } catch (error) {
      errorMessage = error.message;
    }
  }

  onMount(load);

  export function refresh() {
    return load();
  }

  const MEDAL = ['🥇', '🥈', '🥉'];
</script>

{#if ranking.length > 0}
  <div class="board">
    <div class="board-head">
      <h2>이번 주 랭킹</h2>
      <span class="sub">매주 월요일 0시에 새로 시작해요</span>
    </div>
    <ol>
      {#each ranking as row, i (row.userId)}
        <li class:me={row.userId === myUserId} class:champion={i === 0}>
          <span class="rank">{MEDAL[i] ?? i + 1}</span>
          <span class="name">{row.name}{row.userId === myUserId ? ' (나)' : ''}</span>
          <span class="score">{row.bestScore}점</span>
          <span class="count">{row.quizCount}회 도전</span>
        </li>
      {/each}
    </ol>
  </div>
{:else if errorMessage}
  <p class="error">✗ {errorMessage}</p>
{/if}

<style>
  .board {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 6px;
    padding: 18px 20px 16px;
    box-shadow: var(--shadow-card);
  }

  .board-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .board-head h2 {
    font-size: 19px;
  }

  .sub {
    font-size: 11px;
    color: var(--ink-soft);
    flex-shrink: 0;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 5px;
    font-size: 14px;
  }

  li.champion {
    background: var(--gold-soft);
    border: 1px solid var(--gold);
  }

  li.me:not(.champion) {
    background: var(--paper-line);
  }

  .rank {
    width: 26px;
    flex-shrink: 0;
    font-family: var(--font-mono);
    text-align: center;
    color: var(--ink-soft);
  }

  .champion .rank {
    font-size: 18px;
  }

  .name {
    font-family: var(--font-hand);
    font-size: 17px;
    flex: 1;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--ink);
  }

  .count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-soft);
    flex-shrink: 0;
  }

  .error {
    color: var(--red);
    font-size: 13px;
  }
</style>
