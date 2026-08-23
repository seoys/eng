export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakWord(word) {
  if (!canSpeak() || !word) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}
