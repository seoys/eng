<script>
  import { onMount } from 'svelte';
  import { fetchDecks, deleteDeck, shareDeck, fetchOtherUsers, sendChallenge } from './api.js';

  export let onSelectDeck = () => {};

  let decks = [];
  let otherUsers = [];
  let errorMessage = '';
  let sharingId = null;

  let page = 1;
  let totalPages = 1;
  let total = 0;

  let openChallengeId = null;
  let challengeTarget = '';
  let challengeError = '';
  let challengeSending = false;
  let challengeSentId = null;

  async function loadDecks() {
    try {
      const result = await fetchDecks(page);
      decks = result.items;
      total = result.total;
      totalPages = result.totalPages;

      if (decks.length === 0 && page > 1) {
        page -= 1;
        await loadDecks();
      }
    } catch (error) {
      errorMessage = error.message;
    }
  }

  function goToPage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    page = nextPage;
    loadDecks();
  }

  async function loadOtherUsers() {
    try {
      otherUsers = await fetchOtherUsers();
    } catch {
      // challenge picker just stays empty; not fatal to the deck list
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

  function toggleChallenge(event, deckId) {
    event.stopPropagation();
    challengeError = '';
    challengeSentId = null;
    openChallengeId = openChallengeId === deckId ? null : deckId;
    challengeTarget = '';
  }

  async function handleSendChallenge(event, deckId) {
    event.stopPropagation();
    if (!challengeTarget) {
      challengeError = '상대를 선택해주세요';
      return;
    }
    challengeSending = true;
    challengeError = '';
    try {
      await sendChallenge(deckId, challengeTarget);
      challengeSentId = deckId;
      openChallengeId = null;
    } catch (error) {
      challengeError = error.message;
    } finally {
      challengeSending = false;
    }
  }

  onMount(() => {
    loadDecks();
    loadOtherUsers();
  });

  export function refresh() {
    page = 1;
    return loadDecks();
  }
</script>

<div class="deck-list">
  <div class="section-head">
    <h2 class="section-title">단어장</h2>
    {#if total > 0}<span class="total-count">총 {total}개</span>{/if}
  </div>

  {#if errorMessage}
    <p class="error">✗ {errorMessage}</p>
  {/if}

  {#if total === 0 && !errorMessage}
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

        <div class="actions">
          <button
            class="challenge"
            type="button"
            aria-label="{deck.name} 도전장 보내기"
            on:click={(e) => toggleChallenge(e, deck.id)}
          >
            ⚔️
          </button>

          {#if !deck.ownerName}
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
          {/if}
        </div>
      </li>

      {#if openChallengeId === deck.id}
        <li class="challenge-picker" on:click={(e) => e.stopPropagation()}>
          <span class="picker-label">"{deck.name}"에서 내 최고 점수에 도전장 보내기</span>
          <div class="picker-row">
            <select bind:value={challengeTarget}>
              <option value="" disabled selected>상대 선택</option>
              {#each otherUsers as user (user.id)}
                <option value={user.id}>{user.name}</option>
              {/each}
            </select>
            <button
              type="button"
              disabled={challengeSending}
              on:click={(e) => handleSendChallenge(e, deck.id)}
            >
              보내기
            </button>
          </div>
          {#if challengeError}<p class="picker-error">✗ {challengeError}</p>{/if}
        </li>
      {/if}

      {#if challengeSentId === deck.id}
        <li class="challenge-sent">🎯 도전장을 보냈어요!</li>
      {/if}
    {/each}
  </ul>

  {#if totalPages > 1}
    <div class="pager">
      <button
        type="button"
        class="page-nav"
        disabled={page <= 1}
        on:click={() => goToPage(page - 1)}
      >
        ← 이전
      </button>
      <span class="page-indicator">{page} / {totalPages} 페이지</span>
      <button
        type="button"
        class="page-nav"
        disabled={page >= totalPages}
        on:click={() => goToPage(page + 1)}
      >
        다음 →
      </button>
    </div>
  {/if}
</div>

<style>
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 20px;
    margin: 0;
  }

  .total-count {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-soft);
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  }

  .page-nav {
    font-family: var(--font-hand);
    font-size: 14px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--card-border);
    background: var(--card);
    color: var(--ink);
  }

  .page-nav:hover:not(:disabled) {
    border-color: var(--gold);
    background: var(--gold-soft);
  }

  .page-nav:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .page-indicator {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-soft);
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

  .challenge {
    background: none;
    border: 1px solid var(--card-border);
    font-size: 13px;
    padding: 3px 8px;
    border-radius: 999px;
    line-height: 1.4;
  }

  .challenge:hover {
    border-color: var(--red);
    background: var(--red-soft);
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

  .challenge-picker {
    list-style: none;
    background: var(--red-soft);
    border: 1px dashed var(--red);
    border-radius: 6px;
    padding: 12px 16px;
    margin-top: -6px;
    cursor: default;
  }

  .picker-label {
    display: block;
    font-size: 13px;
    color: var(--ink);
    margin-bottom: 8px;
  }

  .picker-row {
    display: flex;
    gap: 8px;
  }

  .picker-row select {
    flex: 1;
    font-family: var(--font-body);
    font-size: 13px;
    padding: 5px 8px;
    border-radius: 4px;
    border: 1px solid var(--card-border);
    background: var(--card);
    color: var(--ink);
  }

  .picker-row button {
    font-family: var(--font-hand);
    font-size: 13px;
    padding: 5px 14px;
    border-radius: 4px;
    border: 1.5px solid var(--red);
    background: var(--card);
    color: var(--red);
  }

  .picker-row button:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  .picker-error {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--red);
  }

  .challenge-sent {
    list-style: none;
    text-align: center;
    font-size: 13px;
    color: var(--green);
    margin-top: -6px;
  }
</style>
