const EXTRACT_TOOL = {
  name: 'extract_words',
  description: 'Extract English words and their Korean meanings visible in the image',
  input_schema: {
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
};

function parseToolResponse(response) {
  const toolUseBlock = response.content.find((block) => block.type === 'tool_use');
  if (!toolUseBlock || !Array.isArray(toolUseBlock.input?.words)) {
    throw new Error('No valid tool_use block with words array found in response');
  }

  return toolUseBlock.input.words.filter(
    (item) =>
      typeof item.word === 'string' &&
      item.word.trim() &&
      typeof item.meaning === 'string' &&
      item.meaning.trim(),
  );
}

export function createVisionExtractor({ client, model }) {
  async function callOnce(base64, mediaType) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_words' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: '이미지 속 영어 단어와 그에 대응하는 한글 뜻을 모두 찾아서 extract_words 도구를 호출해줘.',
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
