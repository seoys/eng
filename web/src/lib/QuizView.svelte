<script>
  import { fetchQuiz, checkAnswer } from './api.js';

  export let deckId;
  export let onFinish = () => {};

  let questions = [];
  let currentIndex = 0;
  let currentAnswer = '';
  let feedback = null;
  let correctCount = 0;
  let loading = true;

  async function loadQuiz() {
    loading = true;
    questions = await fetchQuiz(deckId, 10);
    currentIndex = 0;
    correctCount = 0;
    feedback = null;
    loading = false;
  }

  loadQuiz();

  $: currentQuestion = questions[currentIndex];

  async function submitAnswer() {
    const result = await checkAnswer(currentQuestion.wordId, currentAnswer);
    feedback = result;
    if (result.result !== 'wrong') correctCount += 1;
  }

  function nextQuestion() {
    currentAnswer = '';
    feedback = null;
    if (currentIndex + 1 < questions.length) {
      currentIndex += 1;
    } else {
      onFinish({ total: questions.length, correct: correctCount });
    }
  }
</script>

{#if loading}
  <p>문제를 불러오는 중...</p>
{:else if currentQuestion}
  <div class="quiz">
    <p class="meaning">{currentQuestion.meaning}</p>

    {#if !feedback}
      <input type="text" bind:value={currentAnswer} placeholder="영어 스펠링을 입력하세요" />
      <button on:click={submitAnswer}>제출</button>
    {:else}
      <p class="feedback {feedback.result}">
        {feedback.result === 'wrong' ? '오답' : '정답'} — 정답: {feedback.correctSpelling}
      </p>
      <button on:click={nextQuestion}>다음 문제</button>
    {/if}

    <p class="progress">{currentIndex + 1} / {questions.length}</p>
  </div>
{:else}
  <p>이 단어장에는 문제를 낼 단어가 없습니다.</p>
{/if}

<style>
  .feedback.correct,
  .feedback.close {
    color: seagreen;
  }
  .feedback.wrong {
    color: crimson;
  }
</style>
