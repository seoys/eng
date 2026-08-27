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

  const HINT_KEY = 'eng-quiz-decklist-hint-dismissed';
  let showHint = typeof localStorage !== 'undefined' && !localStorage.getItem(HINT_KEY);

  function dismissHint() {
    if (!showHint) return;
    showHint = false;
    localStorage.setItem(HINT_KEY, '1');
  }

  function handleSelectDeck(deck) {
    dismissHint();
    onSelectDeck(deck);
  }

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

  async function handleDelete(event, deck) {
    event.stopPropagation();
    if (!confirm(`"${deck.name}" 단어장을 삭제하시겠습니까? 안에 있는 단어와 기록도 함께 사라져요.`)) return;

    await deleteDeck(deck.id);
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
    {#each decks as deck (deck.id)}
      <li class="deck-card">
        <button
          type="button"
          class="deck-info"
          aria-label="{deck.name} 시험 보기"
          on:click={() => handleSelectDeck(deck)}
        >
          {#if deck.ownerName}
            <span class="owner-tag">{deck.ownerName}</span>
          {/if}
          <span class="deck-name">{deck.name}</span>
          <span class="deck-count">{deck.wordCount}개</span>
        </button>

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
              <span class="shared-badge">✓ 공유됨</span>
            {:else}
              <button
                class="share"
                type="button"
                aria-label="{deck.name} 다른 사람에게 공유하기"
                disabled={sharingId === deck.id}
                on:click={(e) => handleShare(e, deck)}
              >
                <span aria-hidden="true">👥</span>
                {sharingId === deck.id ? '공유 중…' : '공유하기'}
              </button>
            {/if}
            <button
              class="delete"
              type="button"
              aria-label="{deck.name} 삭제"
              on:click={(e) => handleDelete(e, deck)}
            >
              ✕
            </button>
          {/if}
        </div>
      </li>

      {#if openChallengeId === deck.id}
        <li class="challenge-picker">
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

  {#if showHint && total > 0}
    <div class="hint-bubble">단어장을 클릭하면 시험을 볼 수 있어요</div>
  {/if}

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
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    text-align: center;
  }

  .hint-bubble {
    position: relative;
    display: inline-block;
    margin: 10px 0 0 16px;
    background: var(--gradient-accent);
    color: #ffffff;
    font-family: var(--font-hand);
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    padding: 7px 14px;
    border-radius: 999px;
    box-shadow: var(--shadow-card);
    animation: hint-bounce 1.6s ease-in-out infinite;
    pointer-events: none;
  }

  .hint-bubble::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 22px;
    border: 6px solid transparent;
    border-bottom-color: var(--red);
  }

  @keyframes hint-bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(4px);
    }
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
    border-left: 3px solid var(--red);
    border-radius: var(--r);
    padding: 15px 18px;
    box-shadow: var(--shadow-card-lift);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .deck-card:hover,
  .deck-card:focus-within {
    transform: translateX(2px);
    box-shadow: var(--shadow-card-lift), -3px 0 0 var(--red-soft);
  }

  .deck-info {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
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
    font-weight: 600;
    font-size: 18px;
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--red-soft);
    border: 1.5px solid var(--red);
    color: var(--red);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 999px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .share:hover:not(:disabled) {
    background: var(--red);
    color: #fff;
  }

  .share:disabled {
    opacity: 0.6;
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
    border-radius: 8px;
    line-height: 1;
  }

  .delete:hover {
    color: var(--red);
    background: var(--red-soft);
  }

  .challenge-picker {
    list-style: none;
    background: var(--red-soft);
    border: 1px solid var(--red);
    border-radius: 16px;
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
    border-radius: 8px;
    border: 1px solid var(--card-border);
    background: var(--card);
    color: var(--ink);
  }

  .picker-row button {
    font-family: var(--font-hand);
    font-size: 13px;
    padding: 5px 14px;
    border-radius: 8px;
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

  /* On a phone the row is too narrow for owner-tag + name + count + actions on
     one line — stack the info so the deck name is actually readable. */
  @media (max-width: 480px) {
    .deck-card {
      align-items: stretch;
      padding: 13px 14px;
    }

    .deck-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .deck-name {
      white-space: normal;
      overflow: visible;
      font-size: 16px;
      line-height: 1.35;
    }

    .actions {
      align-items: flex-start;
    }
  }
</style>
