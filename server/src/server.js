import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { buildApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { createVisionExtractor } from './services/visionExtract.js';

async function main() {
  await connectMongo(process.env.MONGODB_URI);

  const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });

  const visionExtractor = createVisionExtractor({
    client: anthropicClient,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  });

  const app = buildApp({ visionExtractor });
  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
