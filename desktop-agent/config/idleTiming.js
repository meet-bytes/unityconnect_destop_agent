// Central place to configure idle timings (in seconds).
// Edit these two numbers only:

const IDLE_THRESHOLD_SECONDS = 30; // idle starts after this many seconds of inactivity
const WARNING_COUNTDOWN_SECONDS = 10; // countdown shown before idle (10 -> 0)

// Safety checks (fail fast on invalid config)
if (!Number.isInteger(IDLE_THRESHOLD_SECONDS) || IDLE_THRESHOLD_SECONDS <= 0) {
  throw new Error(
    `[idleTiming] IDLE_THRESHOLD_SECONDS must be a positive integer. Got: ${IDLE_THRESHOLD_SECONDS}`,
  );
}
if (
  !Number.isInteger(WARNING_COUNTDOWN_SECONDS) ||
  WARNING_COUNTDOWN_SECONDS <= 0
) {
  throw new Error(
    `[idleTiming] WARNING_COUNTDOWN_SECONDS must be a positive integer. Got: ${WARNING_COUNTDOWN_SECONDS}`,
  );
}
if (WARNING_COUNTDOWN_SECONDS > IDLE_THRESHOLD_SECONDS) {
  throw new Error(
    `[idleTiming] WARNING_COUNTDOWN_SECONDS (${WARNING_COUNTDOWN_SECONDS}) cannot be greater than ` +
      `IDLE_THRESHOLD_SECONDS (${IDLE_THRESHOLD_SECONDS}).`,
  );
}

module.exports = { IDLE_THRESHOLD_SECONDS, WARNING_COUNTDOWN_SECONDS };
