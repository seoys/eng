// Enriches freshly-extracted words with memory aids in ONE batched LLM call,
// so that downstream features (hints, cloze mode, confusable quizzes, phonics)
// never need a live model call. Enrichment is best-effort: a failure here must
// not block the upload, so callers treat a throw as "no enrichment this time".

const ENRICH_TOOL = {
  type: 'function',
  function: {
    name: 'enrich_words',
    description: 'Produce memory aids for English vocabulary words aimed at Korean elementary learners',
    parameters: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              word: { type: 'string', description: 'Echo the given word exactly, for alignment' },
              mnemonic: {
                type: 'string',
                description:
                  'ONE short Korean sentence to remember the spelling or meaning — sound resemblance to Korean, a vivid image, or a word-part breakdown. Playful and concrete. Korean only.',
              },
              syllables: {
                type: 'string',
                description: 'The word split into syllables joined by "·", e.g. "bac·te·ri·a"',
              },
              soundTip: {
                type: 'string',
                description:
                  'ONE short Korean tip about a sound Korean speakers often get wrong in this word (th, r vs l, f vs p, final consonants, ...). Empty string if nothing notable.',
              },
              confusables: {
                type: 'array',
                items: { type: 'string' },
                description:
                  '0-3 real English words easily confused with this one by spelling or sound (e.g. "desert"/"dessert"). Empty if none.',
              },
              clozeSentence: {
                type: 'string',
                description:
                  'ONE simple English sentence (max 10 words, vocabulary a 10-year-old knows) that uses the word, with the word replaced by "___". Context must make the answer obvious.',
              },
              difficulty: {
                type: 'integer',
                description:
                  'How hard the word is to SPELL for a Korean 10-year-old: 1 very easy ("cat"), 5 hard ("necessary").',
              },
            },
            required: [
              'word',
              'mnemonic',
              'syllables',
              'soundTip',
              'confusables',
              'clozeSentence',
              'difficulty',
            ],
          },
        },
      },
      required: ['words'],
    },
  },
};

function clampDifficulty(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

function normalizeEntry(item) {
  return {
    mnemonic: typeof item.mnemonic === 'string' ? item.mnemonic.trim() : '',
    syllables: typeof item.syllables === 'string' ? item.syllables.trim() : '',
    soundTip: typeof item.soundTip === 'string' ? item.soundTip.trim() : '',
    confusables: Array.isArray(item.confusables)
      ? item.confusables.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim()).slice(0, 3)
      : [],
    clozeSentence: typeof item.clozeSentence === 'string' ? item.clozeSentence.trim() : '',
    difficulty: clampDifficulty(item.difficulty),
  };
}

function parseToolResponse(response) {
  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== 'enrich_words') {
    throw new Error('No valid enrich_words tool call found in response');
  }

  let parsedArgs;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error('Tool call arguments were not valid JSON');
  }

  if (!Array.isArray(parsedArgs.words)) {
    throw new Error('No valid words array found in tool call arguments');
  }

  const byWord = new Map();
  for (const item of parsedArgs.words) {
    if (typeof item?.word !== 'string' || !item.word.trim()) continue;
    byWord.set(item.word.trim().toLowerCase(), normalizeEntry(item));
  }
  return byWord;
}

export function createWordEnricher({ client, model }) {
  async function callOnce(words) {
    const list = words
      .map((w, i) => `${i + 1}. ${w.word} — ${w.meaning}`)
      .join('\n');

    const response = await client.chat.completions.create({
      model,
      tools: [ENRICH_TOOL],
      tool_choice: { type: 'function', function: { name: 'enrich_words' } },
      messages: [
        {
          role: 'user',
          content:
            '아래 영어 단어들(초등학생용)에 대해 enrich_words 함수를 호출해줘. 각 단어의 "word" 필드는 준 그대로 echo 해줘.\n\n' +
            list,
        },
      ],
    });

    return parseToolResponse(response);
  }

  // Returns Map<lowercased word, enrichment>. Words the model omitted simply
  // won't have an entry; the caller stores null for those.
  return async function enrichWords(words) {
    if (!Array.isArray(words) || words.length === 0) return new Map();
    try {
      return await callOnce(words);
    } catch (firstError) {
      try {
        return await callOnce(words);
      } catch (secondError) {
        throw new Error(`Word enrichment failed after retry: ${secondError.message}`);
      }
    }
  };
}
