<script>
  import { onMount } from 'svelte';
  import { fetchDecks, deleteDeck, shareDeck } from './api.js';

  export let onSelectDeck = () => {};

  let decks = [];
  let errorMessage = '';
  let sharingId = null;

  async function loadDecks() {
    try {
      decks = await fetchDecks();
    } catch (error) {
      errorMessage = error.message;
    }
  }

  async function handleDelete(event, deckId) {
    event.stopPropagation();
    await deleteDeck(deckId);
    await loadDecks();
  }

  async function handleShare(event, deck) {
    event.stopPropagation();
    if (!confirm(`"${deck.name}" 단어장을 다른 사람들도 볼 수 있게 공유하시겠습니까?`)) return;

    sharingId = deck.id;
    try {
      await shareDeck(deck.id);
      await loadDecks();
    } catch (error) {
      errorMessage = error.message;
    } finally {
      sharingId = null;
    }
  }

  onMount(loadDecks);

  export function refresh() {
    return loadDecks();
  }
</script>

<div class="deck-list">
  <h2 class="section-title">단어장</h2>

  {#if errorMessage}
    <p class="error">✗ {errorMessage}</p>
  {/if}

  {#if decks.length === 0 && !errorMessage}
    <p class="empty">아직 카드가 없어요. 위에서 사진을 올려 첫 단어장을 만들어보세요.</p>
  {/if}

  <ul>
    {#each decks as deck, i (deck.id)}
      <li
        class="deck-card"
        style="--tilt: {i % 2 === 0 ? '-0.6deg' : '0.6deg'}"
        on:click={() => onSelectDeck(deck)}
      >
        <span class="fold" aria-hidden="true"></span>
        <div class="deck-info">
          {#if deck.ownerName}
            <span class="owner-tag">{deck.ownerName}</span>
          {/if}
          <span class="deck-name">{deck.name}</span>
          <span class="deck-count">{deck.wordCount}개</span>
        </div>

        {#if !deck.ownerName}
          <div class="actions">
            {#if deck.shared}
              <span class="shared-badge">공유됨</span>
            {:else}
              <button
                class="share"
                type="button"
                aria-label="{deck.name} 공유"
                disabled={sharingId === deck.id}
                on:click={(e) => handleShare(e, deck)}
              >
                공유
              </button>
            {/if}
            <button
              class="delete"
              type="button"
              aria-label="{deck.name} 삭제"
              on:click={(e) => handleDelete(e, deck.id)}
            >
              ✕
            </button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .section-title {
    font-size: 20px;
    margin-bottom: 12px;
  }

  .error {
    color: var(--red);
    font-size: 14px;
  }

  .empty {
    color: var(--ink-soft);
    font-size: 14px;
    padding: 18px;
    border: 1px dashed var(--card-border);
    border-radius: 5px;
    text-align: center;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .deck-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 4px;
    padding: 14px 18px;
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transform: rotate(var(--tilt));
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .deck-card:hover {
    transform: rotate(0deg) translateY(-2px);
    box-shadow: var(--shadow-card-lift);
  }

  .fold {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 16px 16px 0;
    border-color: transparent var(--paper) transparent transparent;
    filter: drop-shadow(-1px 1px 1px rgba(0, 0, 0, 0.15));
  }

  .deck-info {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  .owner-tag {
    flex-shrink: 0;
    font-family: var(--font-script);
    font-size: 13px;
    color: var(--accent-owner, var(--gold));
    background: var(--gold-soft);
    border: 1px solid var(--gold);
    border-radius: 999px;
    padding: 1px 10px;
  }

  .deck-name {
    font-family: var(--font-hand);
    font-size: 19px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deck-count {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-soft);
    flex-shrink: 0;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .share {
    background: none;
    border: 1px solid var(--card-border);
    color: var(--ink-soft);
    font-family: var(--font-hand);
    font-size: 13px;
    padding: 3px 10px;
    border-radius: 999px;
    line-height: 1.4;
  }

  .share:hover:not(:disabled) {
    color: var(--gold);
    border-color: var(--gold);
    background: var(--gold-soft);
  }

  .share:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  .shared-badge {
    font-family: var(--font-hand);
    font-size: 12px;
    color: var(--green);
    background: var(--green-soft);
    border: 1px solid var(--green);
    border-radius: 999px;
    padding: 3px 10px;
    line-height: 1.4;
  }

  .delete {
    background: none;
    border: none;
    color: var(--ink-soft);
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 3px;
    line-height: 1;
  }

  .delete:hover {
    color: var(--red);
    background: var(--red-soft);
  }
</style>
