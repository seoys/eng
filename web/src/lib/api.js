const BASE_URL = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function uploadDeck(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/decks`, { method: 'POST', body: formData });
  return handleResponse(response);
}

export async function fetchDecks() {
  const response = await fetch(`${BASE_URL}/decks`);
  return handleResponse(response);
}

export async function deleteDeck(deckId) {
  const response = await fetch(`${BASE_URL}/decks/${deckId}`, { method: 'DELETE' });
  return handleResponse(response);
}

export async function fetchQuiz(deckId, count = 10) {
  const params = new URLSearchParams({ count: String(count) });
  if (deckId) params.set('deckId', deckId);
  const response = await fetch(`${BASE_URL}/quiz?${params}`);
  return handleResponse(response);
}

export async function checkAnswer(wordId, answer) {
  const response = await fetch(`${BASE_URL}/quiz/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordId, answer }),
  });
  return handleResponse(response);
}
