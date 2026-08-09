const EXTRACT_TOOL = {
  type: 'function',
  function: {
    name: 'extract_words',
    description: 'Extract English words and their Korean meanings visible in the image',
    parameters: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              word: { type: 'string' },
              meaning: { type: 'string' },
            },
            required: ['word', 'meaning'],
          },
        },
      },
      required: ['words'],
    },
  },
};

function parseToolResponse(response) {
  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== 'extract_words') {
    throw new Error('No valid extract_words tool call found in response');
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

  return parsedArgs.words.filter(
    (item) =>
      typeof item.word === 'string' &&
      item.word.trim() &&
      typeof item.meaning === 'string' &&
      item.meaning.trim(),
  );
}

export function createVisionExtractor({ client, model }) {
  async function callOnce(base64, mediaType) {
    const response = await client.chat.completions.create({
      model,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_words' } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이미지 속 영어 단어와 그에 대응하는 한글 뜻을 모두 찾아서 extract_words 함수를 호출해줘.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
          ],
        },
      ],
    });

    return parseToolResponse(response);
  }

  return async function extractWordsFromImage(base64, mediaType) {
    try {
      return await callOnce(base64, mediaType);
    } catch (firstError) {
      try {
        return await callOnce(base64, mediaType);
      } catch (secondError) {
        throw new Error(`Vision extraction failed after retry: ${secondError.message}`);
      }
    }
  };
}
