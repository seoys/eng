export function createSentenceGenerator({ client, model }) {
  return async function generateExampleSentence(word, meaning) {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: `Write exactly one short, simple English example sentence (max 12 words) that naturally uses the word "${word}" (Korean meaning: ${meaning}). Reply with only the sentence itself — no quotes, no explanation, no translation.`,
        },
      ],
    });

    const sentence = response.choices?.[0]?.message?.content?.trim();
    if (!sentence) {
      throw new Error('No sentence returned from the LLM');
    }
    return sentence.replace(/^["']|["']$/g, '');
  };
}
