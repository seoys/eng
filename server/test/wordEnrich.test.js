import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWordEnricher } from '../src/services/wordEnrich.js';

function fakeResponse(words) {
  return {
    choices: [
      {
        message: {
          tool_calls: [{ function: { name: 'enrich_words', arguments: JSON.stringify({ words }) } }],
        },
      },
    ],
  };
}

// The enrichment shape the service returns (no `word` — that's only the
// alignment key echoed back inside the tool call).
const sample = {
  mnemonic: '펭귄은 "펜을 귄다" — pen + guin!',
  syllables: 'pen·guin',
  soundTip: '',
  confusables: [],
  clozeSentence: 'The ___ waddled across the ice.',
  difficulty: 3,
};

test('enrichWords returns a Map keyed by lowercased word', async () => {
  const client = {
    chat: { completions: { create: async () => fakeResponse([{ word: 'penguin', ...sample }]) } },
  };
  const enrich = createWordEnricher({ client, model: 'fake' });

  const result = await enrich([{ word: 'Penguin', meaning: '펭귄' }]);
  assert.ok(result instanceof Map);
  assert.deepEqual(result.get('penguin'), sample);
});

test('enrichWords fills defaults and clamps difficulty for a sloppy entry', async () => {
  const client = {
    chat: {
      completions: {
        create: async () =>
          fakeResponse([
            { word: 'cat', mnemonic: '고양이 캣!', difficulty: 99, confusables: ['cot', 42, ' cut '] },
          ]),
      },
    },
  };
  const enrich = createWordEnricher({ client, model: 'fake' });

  const entry = (await enrich([{ word: 'cat', meaning: '고양이' }])).get('cat');
  assert.equal(entry.difficulty, 5);
  assert.equal(entry.syllables, '');
  assert.equal(entry.soundTip, '');
  assert.equal(entry.clozeSentence, '');
  assert.deepEqual(entry.confusables, ['cot', 'cut']);
});

test('enrichWords returns an empty Map for no input without calling the model', async () => {
  let called = false;
  const client = {
    chat: {
      completions: {
        create: async () => {
          called = true;
          return fakeResponse([]);
        },
      },
    },
  };
  const enrich = createWordEnricher({ client, model: 'fake' });

  const result = await enrich([]);
  assert.equal(result.size, 0);
  assert.equal(called, false);
});

test('enrichWords retries once then throws if the model keeps failing', async () => {
  let calls = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          calls += 1;
          throw new Error('boom');
        },
      },
    },
  };
  const enrich = createWordEnricher({ client, model: 'fake' });

  await assert.rejects(() => enrich([{ word: 'cat', meaning: '고양이' }]), /failed after retry/);
  assert.equal(calls, 2);
});

test('enrichWords succeeds on the retry after a first failure', async () => {
  let calls = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          calls += 1;
          if (calls === 1) throw new Error('transient');
          return fakeResponse([{ word: 'penguin', ...sample }]);
        },
      },
    },
  };
  const enrich = createWordEnricher({ client, model: 'fake' });

  const result = await enrich([{ word: 'penguin', meaning: '펭귄' }]);
  assert.equal(calls, 2);
  assert.deepEqual(result.get('penguin'), sample);
});
