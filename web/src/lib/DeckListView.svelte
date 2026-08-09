<script>
  import { onMount } from 'svelte';
  import { fetchDecks, deleteDeck } from './api.js';

  export let onSelectDeck = () => {};

  let decks = [];
  let errorMessage = '';

  async function loadDecks() {
    try {
      decks = await fetchDecks();
    } catch (error) {
      errorMessage = error.message;
    }
  }

  async function handleDelete(deckId) {
    await deleteDeck(deckId);
    await loadDecks();
  }

  onMount(loadDecks);

  export function refresh() {
    return loadDecks();
  }
</script>

<div class="deck-list">
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if decks.length === 0}
    <p>단어장이 없습니다. 이미지를 업로드해보세요.</p>
  {/if}

  <ul>
    {#each decks as deck (deck.id)}
      <li>
        <button on:click={() => onSelectDeck(deck)}>{deck.name} ({deck.wordCount}개)</button>
        <button on:click={() => handleDelete(deck.id)}>삭제</button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .error {
    color: crimson;
  }
</style>
