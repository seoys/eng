import 'dotenv/config';
import { buildApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { createLLMClient } from './services/llmClient.js';
import { createVisionExtractor } from './services/visionExtract.js';

async function main() {
  if (!process.env.JWT_SECRET) {
    console.warn('JWT_SECRET is not set — using an insecure default. Set it in server/.env.');
  }

  await connectMongo(process.env.MONGODB_URI);

  const llmClient = createLLMClient();

  const visionExtractor = createVisionExtractor({
    client: llmClient,
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  });

  const app = buildApp({ visionExtractor, jwtSecret: process.env.JWT_SECRET });
  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
