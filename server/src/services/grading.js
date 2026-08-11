export function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

const CLOSE_DISTANCE_THRESHOLD = 2;
const SHORT_WORD_CLOSE_DISTANCE_THRESHOLD = 1;
const SHORT_WORD_MAX_LENGTH = 4;

export function gradeAnswer(correctWord, userAnswer) {
  const normalizedCorrect = correctWord.trim().toLowerCase();
  const normalizedAnswer = userAnswer.trim().toLowerCase();

  if (normalizedAnswer === '') return 'wrong';
  if (normalizedAnswer === normalizedCorrect) return 'correct';

  const threshold =
    normalizedCorrect.length <= SHORT_WORD_MAX_LENGTH
      ? SHORT_WORD_CLOSE_DISTANCE_THRESHOLD
      : CLOSE_DISTANCE_THRESHOLD;

  const distance = levenshteinDistance(normalizedAnswer, normalizedCorrect);
  return distance <= threshold ? 'close' : 'wrong';
}
