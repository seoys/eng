const STYLE_BY_CATEGORY = {
  train: 'chug',
  plane: 'soar',
  helicopter: 'soar',
  ufo: 'soar',
  rocket: 'blast',
  car: 'vroom',
  bus: 'vroom',
  bicycle: 'vroom',
  boat: 'rock',
  fish: 'swim',
  dolphin: 'swim',
  bird: 'flutter',
  butterfly: 'flutter',
  bee: 'flutter',
  penguin: 'waddle',
  duck: 'waddle',
  cat: 'bob',
  dog: 'bob',
  rabbit: 'hop',
  turtle: 'crawl',
  ghost: 'float',
};

const EMOJI_BY_CATEGORY = {
  train: '🚂',
  plane: '✈️',
  helicopter: '🚁',
  ufo: '🛸',
  rocket: '🚀',
  car: '🚗',
  bus: '🚌',
  bicycle: '🚲',
  boat: '⛵',
  fish: '🐟',
  dolphin: '🐬',
  bird: '🐦',
  butterfly: '🦋',
  bee: '🐝',
  penguin: '🐧',
  duck: '🦆',
  cat: '🐱',
  dog: '🐶',
  rabbit: '🐰',
  turtle: '🐢',
  ghost: '👻',
};

export function getTextAnimationClass(category) {
  const style = STYLE_BY_CATEGORY[category];
  return style ? `anim-${style}` : null;
}

export function getPreviewEmoji(category) {
  return EMOJI_BY_CATEGORY[category] ?? null;
}
