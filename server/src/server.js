import 'dotenv/config';
import OpenAI from 'openai';
import { buildApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { createVisionExtractor } from './services/visionExtract.js';

async function main() {
  await connectMongo(process.env.MONGODB_URI);

  const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const visionExtractor = createVisionExtractor({
    client: openaiClient,
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  });

  const app = buildApp({ visionExtractor });
  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
