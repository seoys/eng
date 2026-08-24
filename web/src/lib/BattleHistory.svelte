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

  let filter = 'all';

  function toggleFilter(outcome) {
    filter = filter === outcome ? 'all' : outcome;
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

  $: filteredBattles =
    filter === 'all' ? battles : battles.filter((battle) => myOutcome(battle) === filter);
</script>

{#if battles.length > 0}
  <div class="history">
    <h2>⚔️ 배틀 결과</h2>
    <div class="record">
      <button
        type="button"
        class="record-num win"
        class:active={filter === 'win'}
        on:click={() => toggleFilter('win')}
      >
        {record.win}승
      </button>
      <button
        type="button"
        class="record-num lose"
        class:active={filter === 'lose'}
        on:click={() => toggleFilter('lose')}
      >
        {record.lose}패
      </button>
      {#if record.tie > 0}
        <button
          type="button"
          class="record-num tie"
          class:active={filter === 'tie'}
          on:click={() => toggleFilter('tie')}
        >
          {record.tie}무
        </button>
      {/if}
      {#if filter !== 'all'}
        <button type="button" class="clear-filter" on:click={() => (filter = 'all')}>
          전체 보기
        </button>
      {/if}
    </div>
    <ul>
      {#each filteredBattles as battle (battle.id)}
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
    flex-wrap: wrap;
    gap: 8px;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 10px 14px;
  }

  .record-num {
    font-family: var(--font-hand);
    font-weight: 700;
    font-size: 17px;
    background: none;
    border: 1.5px solid transparent;
    border-radius: 999px;
    padding: 4px 12px;
    transition: background 0.15s ease, border-color 0.15s ease;
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

  .record-num:hover {
    background: var(--paper-line);
  }

  .record-num.win.active {
    background: var(--green-soft);
    border-color: var(--green);
  }

  .record-num.lose.active {
    background: var(--red-soft);
    border-color: var(--red);
  }

  .record-num.tie.active {
    background: var(--paper-line);
    border-color: var(--card-border);
  }

  .clear-filter {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-soft);
    background: none;
    border: none;
    text-decoration: underline;
    padding: 4px 6px;
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
