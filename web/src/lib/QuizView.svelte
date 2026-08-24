<script>
  import { onDestroy } from 'svelte';
  import { fetchQuiz, fetchMistakeQuiz, checkAnswer, submitQuizResult } from './api.js';
  import { getTextAnimationClass } from './wordAnimations.js';

  export let deckId;
  export let source = undefined;
  export let onFinish = () => {};
  export let onBack = () => {};

  const AUTO_ADVANCE_DELAY = 2000;

  let questions = [];
  let currentIndex = 0;
  let currentAnswer = '';
  let feedback = null;
  let correctCount = 0;
  let loading = true;
  let errorMessage = '';
  let autoAdvanceTimer = null;

  const FEEDBACK_LABEL = { correct: '정답!', close: '근접!', wrong: '오답' };

  async function loadQuiz() {
    loading = true;
    errorMessage = '';
    try {
      questions = source === 'mistakes' ? await fetchMistakeQuiz() : await fetchQuiz(deckId);
      currentIndex = 0;
      correctCount = 0;
      feedback = null;
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  loadQuiz();

  $: currentQuestion = questions[currentIndex];
  $: animationClass = currentQuestion ? getTextAnimationClass(currentQuestion.animation) : null;

  function autofocus(node) {
    node.focus();
  }

  async function submitAnswer() {
    try {
      const result = await checkAnswer(currentQuestion.wordId, currentAnswer);
      feedback = result;
      if (result.result !== 'wrong') correctCount += 1;
      autoAdvanceTimer = setTimeout(nextQuestion, AUTO_ADVANCE_DELAY);
    } catch (error) {
      errorMessage = error.message;
    }
  }

  function nextQuestion() {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
    currentAnswer = '';
    feedback = null;
    if (currentIndex + 1 < questions.length) {
      currentIndex += 1;
    } else {
      if (source !== 'mistakes') {
        submitQuizResult(deckId, correctCount, questions.length).catch(() => {});
      }
      onFinish({ total: questions.length, correct: correctCount });
    }
  }

  onDestroy(() => clearTimeout(autoAdvanceTimer));
</script>

<button class="back" type="button" on:click={onBack}>← 목록으로</button>

{#if errorMessage}
  <p class="error">✗ {errorMessage}</p>
{/if}

{#if loading}
  <p class="loading">카드를 꺼내는 중...</p>
{:else if currentQuestion}
  <div class="flashcard">
    <span class="page-no">{currentIndex + 1} / {questions.length}</span>

    {#key currentIndex}
      <p class="meaning {animationClass ?? ''}">{currentQuestion.meaning}</p>
    {/key}

    <div class="answer-row">
      {#if !feedback}
        <input
          type="text"
          bind:value={currentAnswer}
          placeholder="여기에 스펠링을 써 보세요"
          autocomplete="off"
          spellcheck="false"
          use:autofocus
          on:keydown={(e) => e.key === 'Enter' && currentAnswer.trim() && submitAnswer()}
        />
        <button class="submit" on:click={submitAnswer} disabled={!currentAnswer.trim()}>
          제출
        </button>
      {:else}
        <div class="answered-line">{currentAnswer || ' '}</div>
        <button class="next" on:click={nextQuestion}>
          {currentIndex + 1 < questions.length ? '다음 카드 →' : '결과 보기 →'}
        </button>
      {/if}
    </div>

    {#if feedback}
      <div class="stamp {feedback.result}">
        <span class="stamp-text">{FEEDBACK_LABEL[feedback.result]}</span>
        {#if feedback.result !== 'correct'}
          <span class="stamp-answer">{feedback.correctSpelling}</span>
        {/if}
      </div>
    {/if}
  </div>
{:else if !errorMessage}
  <p class="loading">
    {source === 'mistakes' ? '아직 틀린 단어가 없어요!' : '이 단어장에는 문제를 낼 단어가 없습니다.'}
  </p>
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

  .flashcard {
    position: relative;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 20px;
    padding: 30px 32px 34px;
    box-shadow: var(--shadow-card-lift);
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 26px;
    overflow: hidden;
  }

  .page-no {
    position: absolute;
    top: 14px;
    right: 18px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-soft);
  }

  .meaning {
    font-family: var(--font-hand);
    font-size: 40px;
    color: var(--ink);
    text-align: center;
    line-height: 1.3;
    transform-origin: center;
  }

  .anim-chug {
    animation: chug 0.5s ease-in-out infinite;
  }
  @keyframes chug {
    0%,
    100% {
      transform: translateX(0) rotate(0deg);
    }
    25% {
      transform: translateX(-4px) rotate(-1deg);
    }
    75% {
      transform: translateX(4px) rotate(1deg);
    }
  }

  .anim-soar {
    animation: soar 2.4s ease-in-out infinite;
  }
  @keyframes soar {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-10px) rotate(-2deg);
    }
  }

  .anim-blast {
    animation: blast 1s ease-in-out infinite;
  }
  @keyframes blast {
    0%,
    100% {
      transform: translateY(0) scale(1);
    }
    40% {
      transform: translateY(-7px) scale(1.03);
    }
    55% {
      transform: translateY(2px) scale(0.98);
    }
  }

  .anim-vroom {
    animation: vroom 0.35s linear infinite;
  }
  @keyframes vroom {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-3px);
    }
    50% {
      transform: translateX(0);
    }
    75% {
      transform: translateX(3px);
    }
  }

  .anim-rock {
    animation: rock 2.2s ease-in-out infinite;
  }
  @keyframes rock {
    0%,
    100% {
      transform: rotate(-3deg);
    }
    50% {
      transform: rotate(3deg);
    }
  }

  .anim-swim {
    animation: swim 1.8s ease-in-out infinite;
  }
  @keyframes swim {
    0%,
    100% {
      transform: translateY(0) skewX(0deg);
    }
    25% {
      transform: translateY(-5px) skewX(-3deg);
    }
    75% {
      transform: translateY(5px) skewX(3deg);
    }
  }

  .anim-flutter {
    animation: flutter 0.9s ease-in-out infinite;
  }
  @keyframes flutter {
    0%,
    100% {
      transform: translate(0, 0) rotate(0deg);
    }
    20% {
      transform: translate(-3px, -4px) rotate(-2deg);
    }
    40% {
      transform: translate(2px, 2px) rotate(2deg);
    }
    60% {
      transform: translate(-2px, 3px) rotate(-1deg);
    }
    80% {
      transform: translate(3px, -2px) rotate(1deg);
    }
  }

  .anim-waddle {
    animation: waddle 0.5s ease-in-out infinite;
  }
  @keyframes waddle {
    0%,
    100% {
      transform: rotate(-8deg) translateX(-2px);
    }
    50% {
      transform: rotate(8deg) translateX(2px);
    }
  }

  .anim-bob {
    animation: bob 1.4s ease-in-out infinite;
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-4px) rotate(1.5deg);
    }
  }

  .anim-hop {
    animation: hop 0.6s cubic-bezier(0.5, 0, 0.7, 0.4) infinite;
  }
  @keyframes hop {
    0%,
    100% {
      transform: translateY(0) scaleY(1);
    }
    30% {
      transform: translateY(0) scaleY(0.9);
    }
    55% {
      transform: translateY(-14px) scaleY(1.05);
    }
    80% {
      transform: translateY(0) scaleY(0.95);
    }
  }

  .anim-crawl {
    animation: crawl 4s ease-in-out infinite;
  }
  @keyframes crawl {
    0%,
    100% {
      transform: translateX(-3px);
    }
    50% {
      transform: translateX(3px);
    }
  }

  .anim-float {
    animation: float 2.6s ease-in-out infinite;
  }
  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
      opacity: 0.85;
    }
    50% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }

  .answer-row {
    width: 100%;
    max-width: 380px;
    display: flex;
    gap: 10px;
  }

  input {
    flex: 1;
    min-width: 0;
    background: var(--paper);
    border: 1.5px solid var(--card-border);
    border-radius: 12px;
    padding: 9px 12px;
    font-size: 18px;
    letter-spacing: 0.5px;
    color: var(--ink);
    text-align: center;
  }

  input::placeholder {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    opacity: 0.7;
  }

  input:focus-visible {
    outline: none;
    border-color: var(--gold);
  }

  .answered-line {
    flex: 1;
    min-width: 0;
    background: var(--paper);
    border: 1.5px solid var(--card-border);
    border-radius: 12px;
    padding: 9px 12px;
    font-size: 18px;
    letter-spacing: 0.5px;
    text-align: center;
    color: var(--ink-soft);
  }

  .submit,
  .next {
    flex-shrink: 0;
    white-space: nowrap;
    font-family: var(--font-hand);
    font-weight: 700;
    font-size: 15px;
    padding: 9px 18px;
    border-radius: 12px;
    border: none;
    background: var(--gradient-accent);
    color: #ffffff;
    transition: transform 0.1s ease, opacity 0.15s ease;
  }

  .submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .submit:not(:disabled):hover,
  .next:hover {
    opacity: 0.92;
    transform: translateY(-1px);
  }

  .stamp {
    position: absolute;
    right: 18px;
    bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 20px;
    border-radius: 14px;
    font-family: var(--font-script);
    font-weight: 700;
    letter-spacing: 0.02em;
    animation: stamp-down 0.24s cubic-bezier(0.2, 1, 0.4, 1);
  }

  .stamp.correct {
    color: var(--green);
    background: var(--green-soft);
  }
  .stamp.close {
    color: var(--gold);
    background: var(--gold-soft);
  }
  .stamp.wrong {
    color: var(--red);
    background: var(--red-soft);
  }

  .stamp-text {
    font-size: 22px;
    line-height: 1;
  }

  .stamp-answer {
    font-family: var(--font-mono);
    font-size: 13px;
    letter-spacing: 0;
    margin-top: 4px;
  }

  @keyframes stamp-down {
    0% {
      opacity: 0;
      scale: 0.8;
    }
    100% {
      opacity: 1;
      scale: 1;
    }
  }
</style>
