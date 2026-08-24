<script>
  import { login } from './api.js';

  export let onAuthenticated = () => {};

  let name = '';
  let birthDate = '';
  let password = '';
  let submitting = false;
  let errorMessage = '';

  async function handleSubmit(event) {
    event.preventDefault();
    submitting = true;
    errorMessage = '';
    try {
      const auth = await login({ name, birthDate, password });
      onAuthenticated(auth);
    } catch (error) {
      errorMessage = error.message;
    } finally {
      submitting = false;
    }
  }
</script>

<div class="gate">
  <div class="id-card">
    <h1>단어 수첩 만들기</h1>
    <p class="hint">이름과 생년월일, 비밀번호를 적어주세요. 처음이면 새 수첩이 만들어지고, 다음부터는 같은 정보로 이어서 써요.</p>

    <form on:submit={handleSubmit}>
      <label>
        <span>이름</span>
        <input type="text" bind:value={name} autocomplete="name" required />
      </label>

      <label>
        <span>생년월일</span>
        <input type="date" bind:value={birthDate} autocomplete="off" required />
      </label>

      <label>
        <span>비밀번호</span>
        <input
          type="password"
          bind:value={password}
          placeholder="4자 이상"
          autocomplete="current-password"
          minlength="4"
          required
        />
      </label>

      {#if errorMessage}
        <p class="error">✗ {errorMessage}</p>
      {/if}

      <button type="submit" disabled={submitting}>
        {submitting ? '확인하는 중...' : '시작하기 →'}
      </button>
    </form>
  </div>
</div>

<style>
  .gate {
    display: flex;
    justify-content: center;
    padding: 60px 20px;
  }

  .id-card {
    position: relative;
    width: min(360px, 100%);
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 22px;
    padding: 32px 28px 28px;
    box-shadow: var(--shadow-card-lift);
    text-align: center;
  }

  h1 {
    font-size: 25px;
  }

  .hint {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-soft);
  }

  form {
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: left;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label span {
    font-family: var(--font-hand);
    font-size: 15px;
    color: var(--ink);
  }

  input {
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--card-border);
    padding: 6px 2px;
    font-size: 16px;
    color: var(--ink);
    transition: border-color 0.15s ease;
  }

  input:focus-visible {
    outline: none;
    border-bottom-color: var(--gold);
  }

  .error {
    color: var(--red);
    font-size: 13px;
    margin: -4px 0 0;
  }

  button {
    margin-top: 4px;
    font-family: var(--font-hand);
    font-weight: 700;
    font-size: 16px;
    padding: 11px 18px;
    border-radius: 14px;
    border: none;
    background: var(--gradient-accent);
    color: #ffffff;
    transition: transform 0.1s ease, opacity 0.15s ease;
  }

  button:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  button:not(:disabled):hover {
    opacity: 0.92;
    transform: translateY(-1px);
  }
</style>
