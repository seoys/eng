<script>
  import { onMount } from 'svelte';
  import { fetchChallenges } from './api.js';

  export let onStartChallenge = () => {};

  let received = [];
  let errorMessage = '';

  async function load() {
    try {
      const data = await fetchChallenges();
      received = data.received;
    } catch (error) {
      errorMessage = error.message;
    }
  }

  onMount(load);

  export function refresh() {
    return load();
  }
</script>

{#if received.length > 0}
  <div class="inbox">
    <h2>📨 받은 도전장</h2>
    <ul>
      {#each received as challenge (challenge.id)}
        <li>
          <span class="scroll" aria-hidden="true">📜</span>
          <div class="body">
            <p class="line">
              <strong>{challenge.fromName}</strong>님이 <strong>{challenge.deckName}</strong>에서
              <span class="target">{challenge.targetScore}점</span>에 도전장을 보냈어요!
            </p>
          </div>
          <button type="button" on:click={() => onStartChallenge(challenge.deckId)}>
            도전 시작 →
          </button>
        </li>
      {/each}
    </ul>
  </div>
{:else if errorMessage}
  <p class="error">✗ {errorMessage}</p>
{/if}

<style>
  .inbox {
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
    align-items: center;
    gap: 12px;
    background: var(--red-soft);
    border: 1px dashed var(--red);
    border-radius: 6px;
    padding: 12px 16px;
  }

  .scroll {
    font-size: 24px;
    flex-shrink: 0;
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .line {
    font-size: 14px;
    color: var(--ink);
    line-height: 1.5;
  }

  .line strong {
    font-family: var(--font-hand);
  }

  .target {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--red);
  }

  button {
    flex-shrink: 0;
    font-family: var(--font-hand);
    font-size: 14px;
    padding: 7px 14px;
    border-radius: 4px;
    border: 1.5px solid var(--red);
    background: var(--card);
    color: var(--red);
  }

  button:hover {
    background: var(--red);
    color: var(--card);
  }

  .error {
    color: var(--red);
    font-size: 13px;
  }
</style>
