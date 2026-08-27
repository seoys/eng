// The app and its users live in Korea, which is always UTC+9 (no DST). Deck
// names and the "how many decks today" count should follow the Seoul calendar
// day, not the UTC one — otherwise anything created between 00:00–09:00 KST
// gets labelled with the previous day's date.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function seoulDateLabel(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// The [start, end) instants (in real UTC) bounding the Seoul day that `date`
// falls in.
export function seoulDayRange(date = new Date()) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const startOfShiftedDay = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const start = new Date(startOfShiftedDay - KST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
