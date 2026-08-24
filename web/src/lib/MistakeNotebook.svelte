<script>
  import { onMount } from 'svelte';
  import { fetchMistakes, fetchMistakeExample } from './api.js';
  import { canSpeak, speakWord } from './speech.js';

  export let onBack = () => {};
  export let onRetry = () => {};

  let mistakes = [];
  let errorMessage = '';
  let loading = true;

  let expandedWordId = null;
  let exampleCache = {};

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

  async function toggleExpand(wordId) {
    if (expandedWordId === wordId) {
      expandedWordId = null;
      return;
    }
    expandedWordId = wordId;
    if (exampleCache[wordId]) return;

    exampleCache = { ...exampleCache, [wordId]: { loading: true, error: '', sentence: '' } };
    try {
      const { sentence } = await fetchMistakeExample(wordId);
      exampleCache = { ...exampleCache, [wordId]: { loading: false, error: '', sentence } };
    } catch (error) {
      exampleCache = {
        ...exampleCache,
        [wordId]: { loading: false, error: error.message, sentence: '' },
      };
    }
  }
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
        <button class="row-main" type="button" on:click={() => toggleExpand(mistake.wordId)}>
          <span class="word">{mistake.word}</span>
          <span class="meaning">{mistake.meaning}</span>
        </button>
        {#if canSpeak()}
          <button
            class="speak"
            type="button"
            aria-label="{mistake.word} 발음 듣기"
            on:click|stopPropagation={() => speakWord(mistake.word)}
          >
            🔊
          </button>
        {/if}
      </li>
      {#if expandedWordId === mistake.wordId}
        <li class="example-row">
          {#if exampleCache[mistake.wordId]?.loading}
            <p class="example-loading">예문 만드는 중...</p>
          {:else if exampleCache[mistake.wordId]?.error}
            <p class="example-error">✗ {exampleCache[mistake.wordId].error}</p>
          {:else if exampleCache[mistake.wordId]?.sentence}
            <div class="example">
              {#if canSpeak()}
                <button
                  class="speak-sentence"
                  type="button"
                  aria-label="예문 발음 듣기"
                  on:click={() => speakWord(exampleCache[mistake.wordId].sentence)}
                >
                  🔊
                </button>
              {/if}
              <span class="sentence">{exampleCache[mistake.wordId].sentence}</span>
            </div>
          {/if}
        </li>
      {/if}
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
    font-weight: 700;
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 12px;
    border: none;
    background: var(--gradient-accent);
    color: #ffffff;
    transition: transform 0.1s ease, opacity 0.15s ease;
  }

  .retry:hover {
    opacity: 0.92;
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
    border-radius: 16px;
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--card);
    padding: 4px 16px;
  }

  .row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: none;
    border: none;
    padding: 8px 0;
    text-align: left;
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

  .example-row {
    background: var(--paper);
    padding: 12px 16px;
  }

  .example-loading {
    font-family: var(--font-hand);
    font-size: 13px;
    color: var(--ink-soft);
  }

  .example-error {
    font-size: 13px;
    color: var(--red);
  }

  .example {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .speak-sentence {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    font-size: 15px;
    line-height: 1.5;
    opacity: 0.8;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .speak-sentence:hover {
    opacity: 1;
    transform: scale(1.15);
  }

  .sentence {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    line-height: 1.5;
  }
</style>
