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
    width: 100%;
    background: var(--gradient-hero);
    border-radius: 22px;
    padding: 24px 32px 22px;
    text-align: center;
    box-shadow: var(--shadow-card);
  }

  .tab h1 {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .cover-sub {
    margin-top: 4px;
    font-size: 14px;
    color: var(--ink-soft);
  }

  .owner-row {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--card-border);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px 12px;
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
    font-size: 13px;
    color: var(--gold);
    padding: 0;
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
    padding: 0;
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

  .score-stamp {
    position: relative;
    align-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 200px;
    padding: 20px 14px 18px;
    border-radius: 20px;
    text-align: center;
    animation: stamp-down 0.28s cubic-bezier(0.2, 1, 0.4, 1);
  }

  .score-stamp.perfect,
  .score-stamp.great {
    color: var(--green);
    background: var(--green-soft);
  }
  .score-stamp.okay {
    color: var(--gold);
    background: var(--gold-soft);
  }
  .score-stamp.retry {
    color: var(--red);
    background: var(--red-soft);
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
      scale: 0.85;
    }
    100% {
      opacity: 1;
      scale: 1;
    }
  }
</style>
