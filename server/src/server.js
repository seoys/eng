import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { createLLMClient } from './services/llmClient.js';
import { createVisionExtractor } from './services/visionExtract.js';
import { createSentenceGenerator } from './services/exampleSentence.js';
import { createWordEnricher } from './services/wordEnrich.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('JWT_SECRET must be set in production. Refusing to start with an insecure default.');
      process.exit(1);
    }
    console.warn('JWT_SECRET is not set — using an insecure default. Set it in server/.env.');
  }

  await connectMongo(process.env.MONGODB_URI);

  const llmClient = createLLMClient();
  const model = process.env.OPENAI_MODEL || 'gpt-5.5';

  const visionExtractor = createVisionExtractor({ client: llmClient, model });

  const sentenceGenerator = createSentenceGenerator({ client: llmClient, model });

  const wordEnricher = createWordEnricher({ client: llmClient, model });

  const staticDir = process.env.STATIC_DIR
    ? path.resolve(__dirname, '..', process.env.STATIC_DIR)
    : undefined;

  const app = buildApp({
    visionExtractor,
    sentenceGenerator,
    wordEnricher,
    jwtSecret: process.env.JWT_SECRET,
    staticDir,
  });
  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
