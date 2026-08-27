let counter = 0;

// A deck of `n` throwaway words, enough to satisfy the server-side check that a
// quiz result's `total` never exceeds the deck's word count.
export function wordList(n) {
  return Array.from({ length: n }, (_, i) => ({ word: `w${i}`, meaning: `뜻${i}` }));
}

export async function registerTestUser(app, overrides = {}) {
  counter += 1;
  const payload = {
    name: `테스트유저${counter}`,
    birthDate: '2000-01-01',
    password: 'test1234',
    ...overrides,
  };

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth',
    payload,
  });

  const body = JSON.parse(response.body);
  return { token: body.token, userId: body.user.id, authHeaders: { authorization: `Bearer ${body.token}` } };
}
