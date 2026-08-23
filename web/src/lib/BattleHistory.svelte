<script>
  import { onMount } from 'svelte';
  import { fetchChallenges } from './api.js';

  let battles = [];
  let errorMessage = '';

  async function load() {
    try {
      const data = await fetchChallenges();
      battles = data.battles;
    } catch (error) {
      errorMessage = error.message;
    }
  }

  onMount(load);

  export function refresh() {
    return load();
  }
</script>

{#if battles.length > 0}
  <div class="history">
    <h2>⚔️ 배틀 결과</h2>
    <ul>
      {#each battles as battle (battle.id)}
        <li>
          <span class="deck-name">{battle.deckName}</span>
          <div class="matchup">
            <span class="side" class:win={battle.winner === 'from'}>
              {battle.fromName}<span class="score">({battle.targetScore})</span>
              {#if battle.winner === 'from'}<span class="win-tag">WIN</span>{/if}
            </span>
            <span class="vs">vs</span>
            <span class="side" class:win={battle.winner === 'to'}>
              {battle.toName}<span class="score">({battle.resultScore})</span>
              {#if battle.winner === 'to'}<span class="win-tag">WIN</span>{/if}
            </span>
          </div>
        </li>
      {/each}
    </ul>
  </div>
{:else if errorMessage}
  <p class="error">✗ {errorMessage}</p>
{/if}

<style>
  .history {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  h2 {
    font-size: 18px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 6px;
    padding: 12px 16px;
  }

  .deck-name {
    font-family: var(--font-hand);
    font-size: 13px;
    color: var(--ink-soft);
  }

  .matchup {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    color: var(--ink);
  }

  .side {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .side.win {
    color: var(--gold);
    font-weight: 700;
  }

  .score {
    font-family: var(--font-mono);
    font-size: 13px;
  }

  .vs {
    color: var(--ink-soft);
    font-family: var(--font-script);
    font-size: 14px;
  }

  .win-tag {
    font-family: var(--font-script);
    font-size: 12px;
    color: var(--card);
    background: var(--gold);
    border-radius: 999px;
    padding: 1px 8px;
    line-height: 1.5;
  }

  .error {
    color: var(--red);
    font-size: 13px;
  }
</style>
