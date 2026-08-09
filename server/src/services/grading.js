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

export function gradeAnswer(correctWord, userAnswer) {
  const normalizedCorrect = correctWord.trim().toLowerCase();
  const normalizedAnswer = userAnswer.trim().toLowerCase();

  if (normalizedAnswer === normalizedCorrect) return 'correct';

  const distance = levenshteinDistance(normalizedAnswer, normalizedCorrect);
  return distance <= CLOSE_DISTANCE_THRESHOLD ? 'close' : 'wrong';
}
