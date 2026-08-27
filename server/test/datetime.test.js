import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoulDateLabel, seoulDayRange } from '../src/services/datetime.js';

test('seoulDateLabel uses the Seoul calendar day, not UTC', () => {
  // 2026-03-11 22:00 UTC is 2026-03-12 07:00 in Seoul.
  const instant = new Date('2026-03-11T22:00:00.000Z');
  assert.equal(seoulDateLabel(instant), '2026-03-12');
});

test('seoulDayRange brackets the Seoul day containing the instant', () => {
  const instant = new Date('2026-03-11T22:00:00.000Z'); // 07:00 KST on the 12th
  const { start, end } = seoulDayRange(instant);

  // Seoul midnight on the 12th is 2026-03-11T15:00Z.
  assert.equal(start.toISOString(), '2026-03-11T15:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-12T15:00:00.000Z');
  assert.ok(start <= instant && instant < end);
});

test('an instant just before Seoul midnight still belongs to the previous day', () => {
  const instant = new Date('2026-03-11T14:59:00.000Z'); // 23:59 KST on the 11th
  assert.equal(seoulDateLabel(instant), '2026-03-11');
});
