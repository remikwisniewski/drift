// @ts-check
// Look-ahead scheduling. Browsers slow timers in background tabs to about once a
// second, so sounds are booked on the audio clock a little ahead of time instead
// of being triggered "now". That keeps the rain falling with the tab hidden.

/** How far ahead events are booked, in seconds. Longer than a throttled timer tick. */
export const LOOKAHEAD = 1.5;

/**
 * Books every event that falls before `now + horizon`.
 * @param {number} next     when the next event is due (audio-clock seconds)
 * @param {number} now      current audio-clock time
 * @param {number} horizon  how far ahead to book
 * @param {() => number} gap  seconds until the following event (may be Infinity)
 * @param {(time: number) => void} book  schedules one event at `time`
 * @param {number} [maxPerTick]  safety cap, so a huge rate can't flood the graph
 * @returns {number} when the event after the booked ones is due
 */
export function bookAhead(next, now, horizon, gap, book, maxPerTick = 400) {
  // After a long pause (a suspended tab), skip what was missed rather than
  // playing it all at once.
  let t = Number.isFinite(next) && next >= now ? next : now + gap();
  let count = 0;
  while (t < now + horizon && count < maxPerTick) {
    book(t);
    count++;
    t += gap();
  }
  return t;
}
