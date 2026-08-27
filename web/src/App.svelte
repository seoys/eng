<script>
  import UploadView from './lib/UploadView.svelte';
  import DeckListView from './lib/DeckListView.svelte';
  import QuizView from './lib/QuizView.svelte';
  import AuthGate from './lib/AuthGate.svelte';
  import RankingBoard from './lib/RankingBoard.svelte';
  import ChallengeInbox from './lib/ChallengeInbox.svelte';
  import BattleHistory from './lib/BattleHistory.svelte';
  import AchievementsPage from './lib/AchievementsPage.svelte';
  import MistakeNotebook from './lib/MistakeNotebook.svelte';
  import { onMount } from 'svelte';
  import { getAuth, clearAuth } from './lib/api.js';

  let auth = getAuth();
  let view = 'list';
  let activeDeckId = null;
  let activeSource = undefined;
  let deckListRef;
  let rankingRef;
  let challengeInboxRef;
  let battleHistoryRef;
  let lastScore = null;

  function handleAuthenticated(newAuth) {
    auth = newAuth;
  }

  function handleLogout() {
    clearAuth();
    auth = null;
    view = 'list';
    activeDeckId = null;
    lastScore = null;
  }

  onMount(() => {
    const onExpired = () => handleLogout();
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  });

  let shareToast = '';
  let shareToastTimer;

  async function shareApp() {
    const url = window.location.origin;
    const shareData = {
      title: '영어단어 수첩',
      text: '사진 속 단어를 모으고, 스펠링으로 복습하는 앱이에요',
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showShareToast('링크를 복사했어요');
        return;
      }
      showShareToast(url);
    } catch {
      // the user dismissed the share sheet — nothing to do
    }
  }

  function showShareToast(message) {
    shareToast = message;
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => (shareToast = ''), 2400);
  }

  function handleUploaded() {
    deckListRef?.refresh();
    view = 'list';
  }

  function handleSelectDeck(deck) {
    activeDeckId = deck.id;
    activeSource = undefined;
    view = 'quiz';
  }

  function handleStartChallenge(deckId) {
    activeDeckId = deckId;
    activeSource = undefined;
    view = 'quiz';
  }

  function handleRetryMistakes() {
    activeDeckId = null;
    activeSource = 'mistakes';
    view = 'quiz';
  }

  function handleFinish(score) {
    lastScore = score;
    view = 'list';
    rankingRef?.refresh();
    challengeInboxRef?.refresh();
    battleHistoryRef?.refresh();
  }

  function handleBack() {
    view = 'list';
  }

  function gradeStamp(score) {
    if (score === 100) return { tier: 'perfect', message: '참 잘했어요!' };
    if (score >= 80) return { tier: 'great', message: '잘했어요!' };
    if (score >= 50) return { tier: 'okay', message: '좋아요, 조금만 더!' };
    return { tier: 'retry', message: '다시 도전해봐요!' };
  }

  $: score = lastScore ? Math.round((lastScore.correct / lastScore.total) * 100) : null;
  $: stamp = score !== null ? gradeStamp(score) : null;
</script>

{#if !auth}
  <div class="notebook">
    <header class="cover">
      <div class="tab">
        <h1>영어단어 수첩</h1>
        <p class="cover-sub">사진 속 단어를 모으고, 스펠링으로 복습해요</p>
        <button class="app-share" type="button" on:click={shareApp}>
          <span aria-hidden="true">📤</span> 앱 공유하기
        </button>
      </div>
    </header>
    <AuthGate onAuthenticated={handleAuthenticated} />
  </div>
{:else}
  <div class="notebook">
    <header class="cover">
      <div class="tab">
        <h1>영어단어 수첩</h1>
        <p class="cover-sub">사진 속 단어를 모으고, 스펠링으로 복습해요</p>
        <button class="app-share" type="button" on:click={shareApp}>
          <span aria-hidden="true">📤</span> 앱 공유하기
        </button>
        <div class="owner-row">
          <span class="owner">{auth.user.name}님의 수첩</span>
          <button class="badges-link" type="button" on:click={() => (view = 'achievements')}>
            🎖️ 달성 기록
          </button>
          <button class="badges-link" type="button" on:click={() => (view = 'mistakes')}>
            📕 오답노트
          </button>
          <button class="logout" type="button" on:click={handleLogout}>로그아웃</button>
        </div>
      </div>
    </header>

    <main class="pages">
      {#if view === 'list'}
        <UploadView onUploaded={handleUploaded} />

        {#if lastScore}
          <div class="score-stamp {stamp.tier}" role="status">
            <span class="score-num">{score}<small>점</small></span>
            <span class="score-msg">{stamp.message}</span>
            <span class="score-detail">{lastScore.correct} / {lastScore.total}개 정답</span>
          </div>
        {/if}

        <ChallengeInbox bind:this={challengeInboxRef} onStartChallenge={handleStartChallenge} />

        <DeckListView bind:this={deckListRef} onSelectDeck={handleSelectDeck} />

        <BattleHistory bind:this={battleHistoryRef} myUserId={auth.user.id} />

        <RankingBoard bind:this={rankingRef} myUserId={auth.user.id} />
      {:else if view === 'quiz'}
        <QuizView
          deckId={activeDeckId}
          source={activeSource}
          onFinish={handleFinish}
          onBack={handleBack}
        />
      {:else if view === 'achievements'}
        <AchievementsPage onBack={handleBack} />
      {:else if view === 'mistakes'}
        <MistakeNotebook onBack={handleBack} onRetry={handleRetryMistakes} />
      {/if}
    </main>
  </div>
{/if}

{#if shareToast}
  <div class="share-toast" role="status">{shareToast}</div>
{/if}

<style>
  .notebook {
    position: relative;
    max-width: 640px;
    margin: 0 auto;
    padding: 40px 20px 80px 46px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* 공책 왼쪽 여백선 — 죽은 여백을 "여백"으로 바꾼다 */
  .notebook::before {
    content: '';
    position: absolute;
    left: 26px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--red);
    opacity: 0.55;
  }

  .notebook::after {
    content: '';
    position: absolute;
    left: 30px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--rule);
  }

  .cover {
    display: flex;
    justify-content: center;
  }

  .tab {
    position: relative;
    width: 100%;
    background: var(--card);
    background-image: repeating-linear-gradient(
      var(--card) 0 31px,
      var(--paper-line) 31px 32px
    );
    border: 1px solid var(--card-border);
    border-left: 3px solid var(--red);
    border-radius: var(--r);
    padding: 26px 30px 20px;
    text-align: center;
    box-shadow: var(--shadow-card);
  }

  .tab h1 {
    font-size: 31px;
    font-weight: 800;
    letter-spacing: -0.022em;
    color: var(--ink);
  }

  .cover-sub {
    margin-top: 6px;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--ink-soft);
  }

  .app-share {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 12px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1.5px solid var(--red);
    background: var(--red-soft);
    color: var(--red);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 12.5px;
    line-height: 1.4;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .app-share:hover {
    background: var(--red);
    color: #fff;
  }

  .share-toast {
    position: fixed;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    max-width: calc(100vw - 32px);
    padding: 10px 18px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    box-shadow: var(--shadow-card-lift);
    z-index: 50;
    animation: toast-in 0.2s ease both;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @media (max-width: 560px) {
    .notebook {
      padding-left: 32px;
    }
    .notebook::before {
      left: 14px;
    }
    .notebook::after {
      left: 18px;
    }
  }

  .owner-row {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--card-border);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 2px 6px;
  }

  .owner {
    font-family: var(--font-script);
    font-size: 16px;
    color: var(--ink);
    white-space: nowrap;
  }

  .badges-link {
    background: none;
    border: none;
    font-family: var(--font-hand);
    font-weight: 600;
    font-size: 13px;
    color: var(--gold);
    padding: 8px 6px;
    white-space: nowrap;
  }

  .badges-link:hover {
    text-decoration: underline;
  }

  .logout {
    background: none;
    border: none;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-soft);
    text-decoration: underline;
    padding: 8px 6px;
    white-space: nowrap;
  }

  .logout:hover {
    color: var(--red);
  }

  .pages {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* 채점 도장 — 고무 스탬프처럼 삐딱하게 찍힌다 */
  .score-stamp {
    position: relative;
    align-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 190px;
    padding: 16px 14px 14px;
    border: 2.5px solid currentColor;
    border-radius: 10px;
    box-shadow: inset 0 0 0 2px var(--paper);
    background: var(--paper);
    text-align: center;
    transform: rotate(-4deg);
    animation: stamp-down 0.28s cubic-bezier(0.2, 1, 0.4, 1);
  }

  .score-stamp.perfect,
  .score-stamp.great {
    color: var(--gold);
  }
  .score-stamp.okay {
    color: var(--ink-soft);
  }
  .score-stamp.retry {
    color: var(--red);
  }

  .score-num {
    font-family: var(--font-hand);
    font-weight: 800;
    font-size: 38px;
    line-height: 1;
  }

  .score-num small {
    font-size: 15px;
    margin-left: 2px;
  }

  .score-msg {
    font-family: var(--font-hand);
    font-weight: 600;
    font-size: 17px;
    letter-spacing: 0.01em;
  }

  .score-detail {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-soft);
    margin-top: 3px;
  }

  @keyframes stamp-down {
    0% {
      opacity: 0;
      transform: rotate(-4deg) scale(1.3);
    }
    60% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: rotate(-4deg) scale(1);
    }
  }
</style>
