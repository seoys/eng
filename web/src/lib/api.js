const BASE_URL = '/api';
const AUTH_KEY = 'eng-quiz-auth';

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function authHeader() {
  const auth = getAuth();
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

async function handleResponse(response) {
  if (response.status === 401) {
    clearAuth();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function login({ name, birthDate, password }) {
  const response = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, birthDate, password }),
  });
  const body = await handleResponse(response);
  setAuth(body);
  return body;
}

export async function uploadDeck(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('file', file);
  }
  const response = await fetch(`${BASE_URL}/decks`, {
    method: 'POST',
    headers: authHeader(),
    body: formData,
  });
  return handleResponse(response);
}

export async function fetchDecks(page = 1, pageSize = 8) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await fetch(`${BASE_URL}/decks?${params}`, { headers: authHeader() });
  return handleResponse(response);
}

export async function deleteDeck(deckId) {
  const response = await fetch(`${BASE_URL}/decks/${deckId}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  return handleResponse(response);
}

export async function shareDeck(deckId) {
  const response = await fetch(`${BASE_URL}/decks/${deckId}/share`, {
    method: 'POST',
    headers: authHeader(),
  });
  return handleResponse(response);
}

export async function fetchQuiz(deckId, count) {
  const params = new URLSearchParams();
  if (deckId) params.set('deckId', deckId);
  if (count) params.set('count', String(count));
  const response = await fetch(`${BASE_URL}/quiz?${params}`, { headers: authHeader() });
  return handleResponse(response);
}

export async function checkAnswer(wordId, answer) {
  const response = await fetch(`${BASE_URL}/quiz/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ wordId, answer }),
  });
  return handleResponse(response);
}

export async function submitQuizResult(deckId, correct, total) {
  const response = await fetch(`${BASE_URL}/quiz/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ deckId, correct, total }),
  });
  return handleResponse(response);
}

export async function fetchWeeklyRanking() {
  const response = await fetch(`${BASE_URL}/rankings/weekly`, { headers: authHeader() });
  return handleResponse(response);
}

export async function fetchOtherUsers() {
  const response = await fetch(`${BASE_URL}/users`, { headers: authHeader() });
  return handleResponse(response);
}

export async function fetchMistakes() {
  const response = await fetch(`${BASE_URL}/mistakes`, { headers: authHeader() });
  return handleResponse(response);
}

export async function fetchMistakeExample(wordId) {
  const response = await fetch(`${BASE_URL}/mistakes/${wordId}/example`, { headers: authHeader() });
  return handleResponse(response);
}

export async function fetchMistakeQuiz(count) {
  const params = new URLSearchParams({ source: 'mistakes' });
  if (count) params.set('count', String(count));
  const response = await fetch(`${BASE_URL}/quiz?${params}`, { headers: authHeader() });
  return handleResponse(response);
}

export async function fetchAchievements() {
  const response = await fetch(`${BASE_URL}/achievements`, { headers: authHeader() });
  return handleResponse(response);
}

export async function fetchChallenges() {
  const response = await fetch(`${BASE_URL}/challenges`, { headers: authHeader() });
  return handleResponse(response);
}

export async function sendChallenge(deckId, toUserId) {
  const response = await fetch(`${BASE_URL}/challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ deckId, toUserId }),
  });
  return handleResponse(response);
}
