let counter = 0;

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
