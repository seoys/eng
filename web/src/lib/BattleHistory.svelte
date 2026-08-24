<script>
  import { onMount } from 'svelte';
  import { fetchChallenges } from './api.js';

  export let myUserId;

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

  function myOutcome(battle) {
    const amChallenger = battle.fromUserId === myUserId;
    if (battle.winner === 'tie') return 'tie';
    if (amChallenger) return battle.winner === 'from' ? 'win' : 'lose';
    return battle.winner === 'to' ? 'win' : 'lose';
  }

  $: record = battles.reduce(
    (acc, battle) => {
      const outcome = myOutcome(battle);
      acc[outcome] += 1;
      return acc;
    },
    { win: 0, lose: 0, tie: 0 },
  );
</script>

{#if battles.length > 0}
  <div class="history">
    <h2>⚔️ 배틀 결과</h2>
    <div class="record">
      <span class="record-num win">{record.win}승</span>
      <span class="record-num lose">{record.lose}패</span>
      {#if record.tie > 0}<span class="record-num tie">{record.tie}무</span>{/if}
    </div>
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

  .record {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 12px 18px;
  }

  .record-num {
    font-family: var(--font-hand);
    font-weight: 700;
    font-size: 17px;
  }

  .record-num.win {
    color: var(--green);
  }

  .record-num.lose {
    color: var(--red);
  }

  .record-num.tie {
    color: var(--ink-soft);
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
    border-radius: 16px;
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
