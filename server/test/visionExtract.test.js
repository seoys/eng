import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisionExtractor } from '../src/services/visionExtract.js';

function fakeResponse(words) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            {
              function: { name: 'extract_words', arguments: JSON.stringify({ words }) },
            },
          ],
        },
      },
    ],
  };
}

test('extractWordsFromImage returns parsed words on success', async () => {
  const client = {
    chat: {
      completions: {
        create: async () =>
          fakeResponse([{ word: 'apple', meaning: '사과', animation: 'none' }]),
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'apple', meaning: '사과', animation: 'none' }]);
});

test('extractWordsFromImage keeps a valid animation category', async () => {
  const client = {
    chat: {
      completions: {
        create: async () =>
          fakeResponse([{ word: 'train', meaning: '기차', animation: 'train' }]),
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'train', meaning: '기차', animation: 'train' }]);
});

test('extractWordsFromImage falls back to "none" for an invalid or missing animation', async () => {
  const client = {
    chat: {
      completions: {
        create: async () =>
          fakeResponse([
            { word: 'apple', meaning: '사과', animation: 'not-a-real-category' },
            { word: 'dog', meaning: '개' },
          ]),
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [
    { word: 'apple', meaning: '사과', animation: 'none' },
    { word: 'dog', meaning: '개', animation: 'none' },
  ]);
});

test('extractWordsFromImage filters out malformed entries', async () => {
  const client = {
    chat: {
      completions: {
        create: async () =>
          fakeResponse([
            { word: 'apple', meaning: '사과', animation: 'none' },
            { word: '', meaning: '빈값' },
            { word: 'cat' },
          ]),
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'apple', meaning: '사과', animation: 'none' }]);
});

test('extractWordsFromImage retries once on failure then throws if still failing', async () => {
  let callCount = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          callCount += 1;
          throw new Error('network error');
        },
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  await assert.rejects(
    () => extract('base64data', 'image/png'),
    /Vision extraction failed after retry/,
  );
  assert.equal(callCount, 2);
});

test('extractWordsFromImage succeeds on retry after first failure', async () => {
  let callCount = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          callCount += 1;
          if (callCount === 1) throw new Error('transient error');
          return fakeResponse([{ word: 'dog', meaning: '개', animation: 'dog' }]);
        },
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'dog', meaning: '개', animation: 'dog' }]);
  assert.equal(callCount, 2);
});
