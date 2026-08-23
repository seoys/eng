# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

영어단어 이미지 퀴즈 앱 — a personal web app. You upload an image containing English words, a Vision LLM extracts the words and their Korean meanings into a deck, and the app quizzes you on spelling from the meaning. Backend is Fastify (`server/`), frontend is Svelte 5 + Vite (`web/`).

## Commands

Backend (`server/`):
```bash
npm install
npm start                # runs src/server.js on $PORT (default 3000)
npm test                 # node --test --test-concurrency=1 (requires test MongoDB, see below)
```

Run a single backend test file:
```bash
node --test test/grading.test.js
```

Frontend (`web/`):
```bash
npm install
npm run dev       # Vite dev server; proxies /api/* to http://localhost:3000 (see vite.config.js)
npm run build
npm run preview
```

There is no lint script in either package.

### Test environment

Server tests need a reachable MongoDB and are configured via `server/.env.test` (gitignored, not `.env`). Load it before running tests:
```bash
cd server
set -a && source .env.test && set +a
npm test
```

## Architecture

Two independent npm packages with no shared code: `server/` (API) and `web/` (SPA), wired together only by the `/api` HTTP proxy in `web/vite.config.js`.

### Backend (`server/src`)

Layering is strict: **routes → models → db**, with **services** as injected, side-effect-free collaborators.

- `app.js` — `buildApp({ visionExtractor })` builds and returns the Fastify instance (CORS, multipart with a 10MB limit, a single error handler that maps status codes to Korean user-facing messages, health check, route registration). It does *not* connect to Mongo or listen — that's `server.js`'s job. This split is what makes the app testable: tests call `buildApp()` with a fake `visionExtractor` and skip the network/DB bootstrap.
- `server.js` — the real entrypoint: loads `.env`, connects Mongo, constructs the real OpenAI-compatible client and vision extractor, calls `buildApp`, and listens.
- `routes/` — Fastify route handlers (`decks.js`, `quiz.js`). Thin: parse the request, call a model function, shape the response. No DB or business logic here.
- `models/` — direct MongoDB collection access (`decks.js` → `decks` collection, `words.js` → `words` collection). `getRandomWords` uses `$sample` for quiz sampling.
- `db/mongo.js` — a lazily-initialized singleton Mongo connection (`connectMongo`/`getDb`/`closeMongo`). All models call `getDb()`; it throws if `connectMongo()` hasn't run yet.
- `services/llmClient.js` — constructs the OpenAI SDK client from `OPENAI_API_KEY`/`OPENAI_BASE_URL` env vars. This is an **OpenAI-compatible Chat Completions endpoint, not Anthropic** — see the note below.
- `services/visionExtract.js` — `createVisionExtractor({ client, model })` returns a function that sends the image (base64 data URL) plus a forced `extract_words` tool call to the LLM and parses the tool-call response into `{word, meaning}` pairs. Retries once on any failure (network, bad tool call, invalid JSON) before throwing.
- `services/grading.js` — pure functions: Levenshtein distance and `gradeAnswer(correct, answer)` → `'correct' | 'close' | 'wrong'`. Threshold is distance ≤1 for words ≤4 chars, ≤2 otherwise. No I/O, easy to unit test directly.

Route → model → response conventions worth preserving when extending:
- IDs cross the API boundary as strings; Mongo `ObjectId` conversion happens at the model layer, never in routes.
- Errors from routes return `{ error: '<Korean message>' }` with an appropriate status code — keep user-facing error text in Korean, consistent with the existing UI.

### Frontend (`web/src`)

Flat, no router — `App.svelte` holds a `view` string (`'list' | 'quiz'`) and switches between three top-level components under `lib/`: `UploadView`, `DeckListView`, `QuizView`. State (active deck, last score) is lifted into `App.svelte` and passed down via props/callbacks.

- `lib/api.js` — the only place that calls `fetch`. All backend calls go through here (`uploadDeck`, `fetchDecks`, `deleteDeck`, `fetchQuiz`, `checkAnswer`); it centralizes the `/api` base URL and non-2xx → `Error` translation (including handling `204 No Content`). Add new backend calls here rather than calling `fetch` from components.

### LLM provider note

The app talks to an **OpenAI-compatible Chat Completions API** (configured via `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` in `server/.env`), not Anthropic/Claude — despite this being a Claude Code project. Don't assume Anthropic SDK conventions when touching `llmClient.js` or `visionExtract.js`.

## Docs

`docs/superpowers/specs/` and `docs/superpowers/plans/` hold the original design spec and implementation plan for the app — useful background on intended behavior when extending features, though the code is the source of truth for current state.
