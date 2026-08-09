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
        create: async () => fakeResponse([{ word: 'apple', meaning: '사과' }]),
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'apple', meaning: '사과' }]);
});

test('extractWordsFromImage filters out malformed entries', async () => {
  const client = {
    chat: {
      completions: {
        create: async () =>
          fakeResponse([
            { word: 'apple', meaning: '사과' },
            { word: '', meaning: '빈값' },
            { word: 'cat' },
          ]),
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'apple', meaning: '사과' }]);
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
          return fakeResponse([{ word: 'dog', meaning: '개' }]);
        },
      },
    },
  };
  const extract = createVisionExtractor({ client, model: 'fake-model' });

  const words = await extract('base64data', 'image/png');
  assert.deepEqual(words, [{ word: 'dog', meaning: '개' }]);
  assert.equal(callCount, 2);
});
