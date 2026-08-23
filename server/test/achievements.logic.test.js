import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAchievements } from '../src/services/achievements.js';

function day(offset) {
  const d = new Date('2026-01-01T09:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function result({ score = 0, total = 10, correct = 0, createdAt = day(0) } = {}) {
  return { score, total, correct, createdAt };
}

function badge(stats, id) {
  return evaluateAchievements(stats).find((b) => b.id === id);
}

test('streak-3 requires three consecutive calendar days of play', () => {
  const notEarned = { results: [result({ createdAt: day(0) }), result({ createdAt: day(2) })], deckCount: 0 };
  assert.equal(badge(notEarned, 'streak-3').earned, false);

  const earned = {
    results: [result({ createdAt: day(0) }), result({ createdAt: day(1) }), result({ createdAt: day(2) })],
    deckCount: 0,
  };
  assert.equal(badge(earned, 'streak-3').earned, true);
});

test('streak-7 needs a full week, not just three days', () => {
  const threeDays = { results: [0, 1, 2].map((i) => result({ createdAt: day(i) })), deckCount: 0 };
  assert.equal(badge(threeDays, 'streak-3').earned, true);
  assert.equal(badge(threeDays, 'streak-7').earned, false);

  const sevenDays = { results: [0, 1, 2, 3, 4, 5, 6].map((i) => result({ createdAt: day(i) })), deckCount: 0 };
  assert.equal(badge(sevenDays, 'streak-7').earned, true);
});

test('a gap in study days resets the streak instead of accumulating', () => {
  const withGap = { results: [0, 1, 3, 4, 5].map((i) => result({ createdAt: day(i) })), deckCount: 0 };
  assert.equal(badge(withGap, 'streak-3').earned, true);
  assert.equal(badge(withGap, 'streak-7').earned, false);
});

test('multiple quizzes on the same day only count as one study day', () => {
  const sameDayTwice = {
    results: [
      result({ createdAt: day(0) }),
      result({ createdAt: new Date(day(0).getTime() + 1000) }),
      result({ createdAt: day(1) }),
    ],
    deckCount: 0,
  };
  assert.equal(badge(sameDayTwice, 'streak-3').earned, false);
});

test('words-50 and words-100 track cumulative question count across quizzes', () => {
  const stats = { results: [result({ total: 40 }), result({ total: 20 })], deckCount: 0 };
  assert.equal(badge(stats, 'words-50').earned, true);
  assert.equal(badge(stats, 'words-100').earned, false);
});

test('perfect-streak-3 requires three 100s in a row, in submission order', () => {
  const broken = {
    results: [result({ score: 100 }), result({ score: 90 }), result({ score: 100 }), result({ score: 100 })],
    deckCount: 0,
  };
  assert.equal(badge(broken, 'perfect-streak-3').earned, false);

  const clean = {
    results: [result({ score: 90 }), result({ score: 100 }), result({ score: 100 }), result({ score: 100 })],
    deckCount: 0,
  };
  assert.equal(badge(clean, 'perfect-streak-3').earned, true);
});

test('quiz-count-10 counts total attempts regardless of score', () => {
  const nine = { results: Array.from({ length: 9 }, () => result()), deckCount: 0 };
  assert.equal(badge(nine, 'quiz-count-10').earned, false);

  const ten = { results: Array.from({ length: 10 }, () => result()), deckCount: 0 };
  assert.equal(badge(ten, 'quiz-count-10').earned, true);
});

test('first-deck reflects deckCount from stats', () => {
  assert.equal(badge({ results: [], deckCount: 0 }, 'first-deck').earned, false);
  assert.equal(badge({ results: [], deckCount: 1 }, 'first-deck').earned, true);
});

test('first-challenge-sent reflects challengesSent from stats', () => {
  assert.equal(badge({ results: [], deckCount: 0, challengesSent: 0 }, 'first-challenge-sent').earned, false);
  assert.equal(badge({ results: [], deckCount: 0, challengesSent: 1 }, 'first-challenge-sent').earned, true);
});

test('challenge-winner is earned when a later result on the same deck beats the target score', () => {
  const notWon = {
    results: [{ ...result({ score: 70, createdAt: day(1) }), deckId: 'deck-1' }],
    deckCount: 0,
    receivedChallenges: [{ deckId: 'deck-1', targetScore: 80, createdAt: day(0) }],
  };
  assert.equal(badge(notWon, 'challenge-winner').earned, false);

  const won = {
    results: [{ ...result({ score: 90, createdAt: day(1) }), deckId: 'deck-1' }],
    deckCount: 0,
    receivedChallenges: [{ deckId: 'deck-1', targetScore: 80, createdAt: day(0) }],
  };
  assert.equal(badge(won, 'challenge-winner').earned, true);
});

test('challenge-winner ignores results from before the challenge was sent', () => {
  const stats = {
    results: [{ ...result({ score: 100, createdAt: day(0) }), deckId: 'deck-1' }],
    deckCount: 0,
    receivedChallenges: [{ deckId: 'deck-1', targetScore: 50, createdAt: day(1) }],
  };
  assert.equal(badge(stats, 'challenge-winner').earned, false);
});

test('challenge-winner ignores results on a different deck than the challenge', () => {
  const stats = {
    results: [{ ...result({ score: 100, createdAt: day(1) }), deckId: 'deck-2' }],
    deckCount: 0,
    receivedChallenges: [{ deckId: 'deck-1', targetScore: 50, createdAt: day(0) }],
  };
  assert.equal(badge(stats, 'challenge-winner').earned, false);
});
