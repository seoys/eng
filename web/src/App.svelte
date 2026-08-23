<script>
  import UploadView from './lib/UploadView.svelte';
  import DeckListView from './lib/DeckListView.svelte';
  import QuizView from './lib/QuizView.svelte';
  import AuthGate from './lib/AuthGate.svelte';
  import { getAuth, clearAuth } from './lib/api.js';

  let auth = getAuth();
  let view = 'list';
  let activeDeckId = null;
  let deckListRef;
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

  function handleUploaded() {
    deckListRef?.refresh();
    view = 'list';
  }

  function handleSelectDeck(deck) {
    activeDeckId = deck.id;
    view = 'quiz';
  }

  function handleFinish(score) {
    lastScore = score;
    view = 'list';
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
        <div class="owner-row">
          <span class="owner">{auth.user.name}님의 수첩</span>
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

        <DeckListView bind:this={deckListRef} onSelectDeck={handleSelectDeck} />
      {:else if view === 'quiz'}
        <QuizView deckId={activeDeckId} onFinish={handleFinish} onBack={handleBack} />
      {/if}
    </main>
  </div>
{/if}

<style>
  .notebook {
    max-width: 640px;
    margin: 0 auto;
    padding: 40px 20px 80px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .cover {
    display: flex;
    justify-content: center;
  }

  .tab {
    position: relative;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 4px 4px 14px 14px;
    padding: 18px 32px 20px;
    text-align: center;
    box-shadow: var(--shadow-card);
    transform: rotate(-1deg);
  }

  .tab::before {
    content: '';
    position: absolute;
    top: -10px;
    left: 50%;
    translate: -50% 0;
    width: 64px;
    height: 20px;
    background: var(--gold-soft);
    border: 1px solid var(--gold);
    border-radius: 3px;
    opacity: 0.9;
  }

  .tab h1 {
    font-size: 34px;
    letter-spacing: 0.5px;
  }

  .cover-sub {
    margin-top: 4px;
    font-size: 14px;
    color: var(--ink-soft);
  }

  .owner-row {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--card-border);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .owner {
    font-family: var(--font-script);
    font-size: 16px;
    color: var(--ink);
  }

  .logout {
    background: none;
    border: none;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-soft);
    text-decoration: underline;
    padding: 0;
  }

  .logout:hover {
    color: var(--red);
  }

  .pages {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .score-stamp {
    position: relative;
    align-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 200px;
    padding: 18px 14px 16px;
    border: 3px double currentColor;
    border-radius: 50% / 40%;
    text-align: center;
    rotate: -5deg;
    animation: stamp-down 0.32s cubic-bezier(0.2, 1.4, 0.5, 1);
  }

  .score-stamp.perfect,
  .score-stamp.great {
    color: var(--green);
  }
  .score-stamp.okay {
    color: var(--gold);
  }
  .score-stamp.retry {
    color: var(--red);
  }

  .score-num {
    font-family: var(--font-hand);
    font-weight: 700;
    font-size: 40px;
    line-height: 1;
  }

  .score-num small {
    font-size: 16px;
    margin-left: 2px;
  }

  .score-msg {
    font-family: var(--font-script);
    font-size: 19px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .score-detail {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-soft);
    margin-top: 2px;
  }

  @keyframes stamp-down {
    0% {
      opacity: 0;
      scale: 1.6;
      rotate: -5deg;
    }
    60% {
      opacity: 1;
      scale: 0.94;
    }
    100% {
      opacity: 1;
      scale: 1;
      rotate: -5deg;
    }
  }
</style>
