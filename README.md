# 영어단어 이미지 퀴즈 앱

영어단어가 포함된 이미지를 업로드하면 Vision LLM이 이미지 속 영어단어와 뜻을 자동으로 추출해 단어장으로 저장하고, 이를 기반으로 랜덤 스펠링 회상 퀴즈를 출제해 채점해주는 개인용 웹 앱입니다. 백엔드는 Fastify(`server/`), 프론트엔드는 Svelte(`web/`)로 구성되어 있습니다.

## Prerequisites

- Node.js 22 LTS
- A reachable MongoDB instance
- An OpenAI-compatible Chat Completions API key/proxy (see note below)

## Setup

```bash
cd server
npm install
cp .env.example .env
# then edit .env and fill in real values (MongoDB URI, OpenAI-compatible API key, etc.)

cd ../web
npm install
```

## Run

Two terminals:

```bash
# Terminal 1 — API server (port 3000)
cd server
npm start
```

```bash
# Terminal 2 — frontend dev server (proxies /api to the backend)
cd web
npm run dev
```

## Test

Requires a reachable test MongoDB instance (configured via `server/.env.test`):

```bash
cd server
set -a && source .env.test && set +a
npm test
```

## LLM provider note

The app talks to an **OpenAI-compatible Chat Completions API** for image word extraction (not Anthropic/Claude). Configure it via the `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` environment variables in `server/.env`.
