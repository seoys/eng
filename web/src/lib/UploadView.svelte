<script>
  import { uploadDeck } from './api.js';

  export let onUploaded = () => {};

  let uploading = false;
  let errorMessage = '';
  let previewWords = [];

  async function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploading = true;
    errorMessage = '';
    previewWords = [];

    try {
      const deck = await uploadDeck(file);
      previewWords = deck.words;
      onUploaded(deck);
    } catch (error) {
      errorMessage = error.message;
    } finally {
      uploading = false;
    }
  }
</script>

<div class="upload-view">
  <input
    type="file"
    accept="image/png,image/jpeg"
    on:change={handleFileChange}
    disabled={uploading}
  />

  {#if uploading}
    <p>이미지 분석 중...</p>
  {/if}

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if previewWords.length > 0}
    <ul>
      {#each previewWords as word (word.id)}
        <li>{word.word} — {word.meaning}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .error {
    color: crimson;
  }
</style>
