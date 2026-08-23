<script>
  import { uploadDeck } from './api.js';
  import { getPreviewEmoji } from './wordAnimations.js';

  export let onUploaded = () => {};

  const LOADING_ANIMALS = ['🐰', '🐿️', '🦔', '🐥'];

  let uploading = false;
  let errorMessage = '';
  let previewWords = [];
  let dragOver = false;

  async function handleFile(file) {
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

  function handleFileChange(event) {
    handleFile(event.target.files[0]);
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    dragOver = false;
    handleFile(event.dataTransfer.files[0]);
  }
</script>

<div class="upload-card">
  <span class="clip" aria-hidden="true">
    <svg viewBox="0 0 24 40" width="20" height="34">
      <path
        d="M6 10 V28 a6 6 0 0 0 12 0 V8 a4 4 0 0 0 -8 0 V26 a2 2 0 0 0 4 0 V12"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </svg>
  </span>

  <h2>새 단어 카드 만들기</h2>
  <p class="hint">영어 단어가 담긴 사진을 붙여넣으면, 단어와 뜻을 자동으로 옮겨 적어드려요.</p>

  <label
    class="dropzone"
    class:drag={dragOver}
    class:busy={uploading}
    on:dragover={(e) => {
      e.preventDefault();
      dragOver = true;
    }}
    on:dragleave={() => (dragOver = false)}
    on:drop={handleDrop}
  >
    <input
      type="file"
      accept="image/png,image/jpeg"
      on:change={handleFileChange}
      disabled={uploading}
    />
    {#if uploading}
      <span class="loader" aria-hidden="true">
        {#each LOADING_ANIMALS as animal, i (animal)}
          <span class="orbit" style="--i: {i}">
            <span class="animal" style="--i: {i}">{animal}</span>
          </span>
        {/each}
      </span>
      <span>단어를 찾고 있어요...</span>
    {:else}
      <span class="plus" aria-hidden="true">＋</span>
      <span>사진 선택 또는 여기에 끌어놓기</span>
    {/if}
  </label>

  {#if errorMessage}
    <p class="error">✗ {errorMessage}</p>
  {/if}

  {#if previewWords.length > 0}
    <ul class="preview">
      {#each previewWords as word (word.id)}
        <li>
          <span class="w">{word.word}</span>
          <span class="m">{word.meaning}</span>
          {#if getPreviewEmoji(word.animation)}
            <span class="anim-tag" title="퀴즈에서 글씨가 움직여요">{getPreviewEmoji(word.animation)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .upload-card {
    position: relative;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 6px;
    padding: 24px 26px 22px;
    box-shadow: var(--shadow-card);
  }

  .clip {
    position: absolute;
    top: -14px;
    left: 24px;
    color: var(--ink-soft);
    transform: rotate(-8deg);
  }

  h2 {
    font-size: 22px;
  }

  .hint {
    margin-top: 6px;
    font-size: 14px;
    color: var(--ink-soft);
  }

  .dropzone {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 26px 16px;
    border: 2px dashed var(--card-border);
    border-radius: 5px;
    text-align: center;
    font-size: 15px;
    color: var(--ink-soft);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .dropzone:hover,
  .dropzone.drag {
    border-color: var(--gold);
    background: var(--gold-soft);
  }

  .dropzone.busy {
    cursor: progress;
  }

  .dropzone input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .plus {
    font-size: 26px;
    color: var(--gold);
    line-height: 1;
  }

  .loader {
    position: relative;
    width: 56px;
    height: 56px;
  }

  .orbit {
    position: absolute;
    inset: 0;
    animation: orbit-spin 2.4s linear infinite;
    animation-delay: calc(var(--i) * -0.6s);
  }

  .orbit .animal {
    position: absolute;
    top: 0;
    left: 50%;
    translate: -50% 0;
    font-size: 20px;
    line-height: 1;
    display: inline-block;
    animation: orbit-counter-spin 2.4s linear infinite;
    animation-delay: calc(var(--i) * -0.6s);
  }

  @keyframes orbit-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes orbit-counter-spin {
    to {
      transform: rotate(-360deg);
    }
  }

  .error {
    margin-top: 12px;
    color: var(--red);
    font-size: 14px;
  }

  .preview {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 180px;
    overflow-y: auto;
  }

  .preview li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 2px;
    border-bottom: 1px dotted var(--card-border);
    font-size: 14px;
  }

  .w {
    font-family: var(--font-mono);
    color: var(--ink);
  }

  .m {
    color: var(--ink-soft);
    flex: 1;
    text-align: right;
  }

  .anim-tag {
    flex-shrink: 0;
    font-size: 15px;
  }
</style>
