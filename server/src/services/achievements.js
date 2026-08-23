const DAY_MS = 24 * 60 * 60 * 1000;

function distinctStudyDays(results) {
  return [...new Set(results.map((r) => r.createdAt.toISOString().slice(0, 10)))].sort();
}

function longestDayStreak(results) {
  const days = distinctStudyDays(results);
  let longest = 0;
  let current = 0;
  let prevTime = null;

  for (const day of days) {
    const time = new Date(`${day}T00:00:00Z`).getTime();
    current = prevTime !== null && time - prevTime === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    prevTime = time;
  }

  return longest;
}

function longestPerfectStreak(results) {
  let longest = 0;
  let current = 0;

  for (const r of results) {
    current = r.score === 100 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}

function totalWordsStudied(results) {
  return results.reduce((sum, r) => sum + r.total, 0);
}

function hasWonAChallenge(results, receivedChallenges) {
  return receivedChallenges.some((challenge) =>
    results.some(
      (r) =>
        r.deckId === challenge.deckId &&
        r.createdAt > challenge.createdAt &&
        r.score > challenge.targetScore,
    ),
  );
}

export const ACHIEVEMENTS = [
  {
    id: 'first-100',
    title: '첫 100점',
    description: '퀴즈에서 처음으로 100점을 받았어요',
    emoji: '💯',
    check: (stats) => stats.results.some((r) => r.score === 100),
  },
  {
    id: 'streak-3',
    title: '3일 연속 학습',
    description: '3일 연속으로 퀴즈를 풀었어요',
    emoji: '🔥',
    check: (stats) => longestDayStreak(stats.results) >= 3,
  },
  {
    id: 'streak-7',
    title: '일주일 개근',
    description: '7일 연속으로 퀴즈를 풀었어요',
    emoji: '📅',
    check: (stats) => longestDayStreak(stats.results) >= 7,
  },
  {
    id: 'words-50',
    title: '단어 50개 학습',
    description: '지금까지 푼 문제가 50개를 넘었어요',
    emoji: '📚',
    check: (stats) => totalWordsStudied(stats.results) >= 50,
  },
  {
    id: 'words-100',
    title: '단어 100개 학습',
    description: '지금까지 푼 문제가 100개를 넘었어요',
    emoji: '📖',
    check: (stats) => totalWordsStudied(stats.results) >= 100,
  },
  {
    id: 'perfect-streak-3',
    title: '3연속 100점',
    description: '세 번 연속으로 100점을 받았어요',
    emoji: '🎯',
    check: (stats) => longestPerfectStreak(stats.results) >= 3,
  },
  {
    id: 'quiz-count-10',
    title: '퀴즈 10회 도전',
    description: '퀴즈를 10번 풀었어요',
    emoji: '🧾',
    check: (stats) => stats.results.length >= 10,
  },
  {
    id: 'first-deck',
    title: '첫 단어장',
    description: '나만의 단어장을 처음 만들었어요',
    emoji: '📔',
    check: (stats) => stats.deckCount >= 1,
  },
  {
    id: 'first-challenge-sent',
    title: '첫 도전장',
    description: '누군가에게 도전장을 처음 보냈어요',
    emoji: '⚔️',
    check: (stats) => stats.challengesSent >= 1,
  },
  {
    id: 'challenge-winner',
    title: '도전 성공',
    description: '받은 도전장에서 상대의 점수를 뛰어넘었어요',
    emoji: '🏆',
    check: (stats) => hasWonAChallenge(stats.results, stats.receivedChallenges ?? []),
  },
];

export function evaluateAchievements(stats) {
  return ACHIEVEMENTS.map((achievement) => ({
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    emoji: achievement.emoji,
    earned: achievement.check(stats),
  }));
}
