export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Ranked by how natural/clear they sound in testing, female voices only.
const PREFERRED_VOICE_NAMES = [
  'Google US English',
  'Samantha',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Zira - English (United States)',
  'Microsoft Zira Desktop - English (United States)',
  'Google UK English Female',
  'Karen',
  'Moira',
  'Victoria',
];

let cachedVoice;

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  for (const name of PREFERRED_VOICE_NAMES) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }

  const femaleEnglish = voices.find((v) => v.lang.startsWith('en') && /female/i.test(v.name));
  if (femaleEnglish) return femaleEnglish;

  return voices.find((v) => v.lang.startsWith('en')) ?? null;
}

function getVoice() {
  if (cachedVoice === undefined) cachedVoice = pickVoice();
  return cachedVoice;
}

if (canSpeak()) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = pickVoice();
  });
}

export function speakWord(word) {
  if (!canSpeak() || !word) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  const voice = getVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  utterance.rate = 0.95;

  window.speechSynthesis.speak(utterance);
}
