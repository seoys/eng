# 영어단어 이미지 퀴즈 앱 — 설계안

- 날짜: 2026-08-09
- 상태: 승인됨 (MVP 범위)

## 배경 / 목적

영어단어가 포함된 이미지를 업로드하면, Vision LLM으로 이미지 속 영어단어와 뜻을 추출하고,
이를 기반으로 랜덤 스펠링 퀴즈를 출제해 암기를 돕는 개인용 웹 앱.

## 범위 (MVP)

포함:
- 이미지 업로드 → 단어/뜻 추출 → 저장 → 랜덤 퀴즈 출제/채점

제외 (추후 고도화 대상):
- 오답 복습(spaced repetition) 기능
- 다중 사용자/로그인
- 객관식 문제 유형 (찍기 가능성 때문에 제외, 스펠링 주관식만 사용)

## 문제 유형

- **스펠링 주관식**: 한글 뜻을 보여주고 영어 단어를 직접 타이핑
  - 재인(recognition)이 아닌 회상(recall) 기반이라 암기 효과가 큼 (객관식 대비 찍기 불가)
- 채점: 완전 일치 우선, Levenshtein 거리 1~2 이내는 "거의 정답" 처리 (구체 임계값은 구현 단계에서 튜닝)

## 기술 스택 버전

- Node.js 22 LTS (설치된 버전 기준)

## 아키텍처

```
[Svelte 프론트엔드] --REST API--> [Fastify API 서버] --> [Claude Vision API (프록시 경유)]
                                          |
                                          v
                                     [MongoDB]
```

- 모노레포 구조: `server/` (Fastify API), `web/` (Svelte 프론트엔드)
- 개인용, 로그인 없음 (단일 사용자 전제)

### 이미지 → 단어 추출 (Vision LLM)

- `@anthropic-ai/sdk` 사용, `baseURL`을 사용자 보유 Anthropic 호환 프록시(예: syterolink 계열)로 설정, API 키는 환경변수로 관리
- 이미지(base64) + 프롬프트를 Claude에 전달 → 이미지 속 영어단어와 한글 뜻을 JSON 배열로 반환하도록 프롬프트 설계
  - 예: `[{ "word": "apple", "meaning": "사과" }, ...]`
- 응답 JSON 파싱 실패 시 재시도 1회, 최종 실패 시 에러 반환

## 데이터 모델 (MongoDB)

```
decks
  _id
  name          // 기본값: 업로드 파일명 또는 생성일 기반 이름
  createdAt

words
  _id
  deckId        // decks._id 참조
  word          // 예: "apple"
  meaning       // 예: "사과"
  createdAt
```

## API 엔드포인트 (Fastify)

- `POST /api/decks` — 이미지 업로드(multipart) → Claude Vision 호출 → 단어 추출 → deck+words 저장 → 생성된 deck 반환
- `GET /api/decks` — 단어장 목록 조회
- `GET /api/decks/:id/words` — 특정 단어장의 단어 목록
- `GET /api/quiz?deckId=...&count=10` — 해당 deck(또는 전체)에서 랜덤 N개 문제 반환 (meaning만 내려주고 word는 숨김)
- `POST /api/quiz/check` — `{ wordId, answer }` → Levenshtein 기반 채점 결과(정답 여부, 정답 스펠링) 반환

## 프론트엔드 흐름 (Svelte)

1. **업로드 화면** — 이미지 드래그&드롭/파일선택 → `POST /api/decks` 호출 → 로딩 → 추출된 단어 리스트 미리보기
2. **단어장 목록 화면** — 기존 단어장 조회, 클릭 시 퀴즈 시작
3. **퀴즈 화면** — 한글 뜻 표시 → 영어 스펠링 입력 → 제출 → 정답/오답 즉시 표시(오답 시 정답 공개) → 다음 문제 자동 진행 → 종료 시 점수 요약(N개 중 M개 정답)

## 에러 처리

- 이미지에서 단어를 인식하지 못한 경우 → "단어를 찾지 못했습니다" 안내, deck 생성하지 않음
- Vision API 호출 실패(네트워크/키 오류) → 사용자에게 명확한 에러 메시지, 서버 로그 기록
- 업로드 파일 형식(jpg/png)·크기(예: 10MB 이하) 제한

## 테스트 계획

- 백엔드 유닛 테스트: Levenshtein 채점 로직, Claude 응답 JSON 파싱
- 수동 검증: 실제 단어 이미지 업로드 후 추출 정확도 확인, 퀴즈 흐름 E2E 확인

## 향후 고도화 후보 (별도 브레인스토밍 예정)

- 오답 단어 복습/재출제
- 스펠링 힌트(첫 글자, 글자 수 등)
- 여러 이미지 병합해 하나의 단어장 만들기
- Redis 활용 (세션 캐시, 진행률 등)
