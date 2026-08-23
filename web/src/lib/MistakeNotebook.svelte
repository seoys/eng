<script>
  import { onMount } from 'svelte';
  import { fetchMistakes } from './api.js';
  import { canSpeak, speakWord } from './speech.js';

  export let onBack = () => {};
  export let onRetry = () => {};

  let mistakes = [];
  let errorMessage = '';
  let loading = true;

  async function load() {
    loading = true;
    errorMessage = '';
    try {
      mistakes = await fetchMistakes();
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<button class="back" type="button" on:click={onBack}>← 목록으로</button>

<div class="header-row">
  <h2>📕 오답노트</h2>
  {#if !loading && mistakes.length > 0}
    <button class="retry" type="button" on:click={onRetry}>다시 풀기 →</button>
  {/if}
</div>

{#if errorMessage}
  <p class="error">✗ {errorMessage}</p>
{/if}

{#if loading}
  <p class="loading">오답노트를 펼치는 중...</p>
{:else if mistakes.length === 0}
  <p class="loading">아직 틀린 단어가 없어요!</p>
{:else}
  <ul class="list">
    {#each mistakes as mistake (mistake.wordId)}
      <li class="row">
        {#if canSpeak()}
          <button
            class="speak"
            type="button"
            aria-label="{mistake.word} 발음 듣기"
            on:click={() => speakWord(mistake.word)}
          >
            🔊
          </button>
        {/if}
        <span class="word">{mistake.word}</span>
        <span class="meaning">{mistake.meaning}</span>
      </li>
    {/each}
  </ul>
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

  .retry {
    font-family: var(--font-hand);
    font-size: 14px;
    padding: 6px 14px;
    border-radius: 4px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    color: var(--ink);
    transition: transform 0.1s ease, background 0.15s ease;
  }

  .retry:hover {
    background: var(--gold-soft);
    transform: translateY(-1px);
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

  .list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--card-border);
    border: 1px solid var(--card-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: var(--card);
    padding: 12px 16px;
  }

  .speak {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    font-size: 15px;
    line-height: 1;
    opacity: 0.75;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .speak:hover {
    opacity: 1;
    transform: scale(1.15);
  }

  .word {
    font-family: var(--font-mono);
    font-size: 15px;
    color: var(--ink);
  }

  .meaning {
    font-family: var(--font-hand);
    font-size: 16px;
    color: var(--ink-soft);
  }
</style>
