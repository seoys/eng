<script>
  import UploadView from './lib/UploadView.svelte';
  import DeckListView from './lib/DeckListView.svelte';
  import QuizView from './lib/QuizView.svelte';

  let view = 'list';
  let activeDeckId = null;
  let deckListRef;
  let lastScore = null;

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
</script>

<main>
  <h1>영어단어 이미지 퀴즈</h1>

  {#if view === 'list'}
    <UploadView onUploaded={handleUploaded} />
    {#if lastScore}
      <p>지난 결과: {lastScore.correct} / {lastScore.total}</p>
    {/if}
    <DeckListView bind:this={deckListRef} onSelectDeck={handleSelectDeck} />
  {:else if view === 'quiz'}
    <QuizView deckId={activeDeckId} onFinish={handleFinish} />
  {/if}
</main>
