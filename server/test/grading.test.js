import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, levenshteinDistance } from '../src/services/grading.js';

test('levenshteinDistance computes edit distance', () => {
  assert.equal(levenshteinDistance('apple', 'apple'), 0);
  assert.equal(levenshteinDistance('aple', 'apple'), 1);
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
});

test('gradeAnswer returns correct for exact match (case/whitespace insensitive)', () => {
  assert.equal(gradeAnswer('apple', 'Apple'), 'correct');
  assert.equal(gradeAnswer('apple', '  apple  '), 'correct');
});

test('gradeAnswer returns close for a minor typo within distance 2', () => {
  assert.equal(gradeAnswer('apple', 'aple'), 'close');
  assert.equal(gradeAnswer('banana', 'banan'), 'close');
});

test('gradeAnswer returns wrong for very different input', () => {
  assert.equal(gradeAnswer('apple', 'orange'), 'wrong');
});

test('gradeAnswer returns wrong for empty or whitespace-only answers', () => {
  assert.equal(gradeAnswer('go', ''), 'wrong');
  assert.equal(gradeAnswer('go', '   '), 'wrong');
});

test('gradeAnswer uses a tighter threshold (1) for short words (<=4 chars)', () => {
  assert.equal(gradeAnswer('cat', 'cut'), 'close');
  assert.equal(gradeAnswer('cat', 'xyz'), 'wrong');
});

test('gradeAnswer keeps threshold 2 for longer words (>4 chars)', () => {
  assert.equal(gradeAnswer('apple', 'aple'), 'close');
  assert.equal(gradeAnswer('banana', 'banan'), 'close');
});
