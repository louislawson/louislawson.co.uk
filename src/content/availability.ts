import type { Profile } from "./schema";
import { isPlaceholder } from "./todo.ts";

const ukDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in the UK as YYYY-MM-DD, which sorts as a string in date order. */
function ukDay(now: Date): string {
  const parts = Object.fromEntries(
    ukDate.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * The availability statement while it is still true, otherwise nothing. It is shown until the end
 * of the `until` day in UK time, so it is compared by calendar date there rather than as an
 * instant, which would read a plain date as UTC midnight. A placeholder date never expires; the
 * placeholder rules decide whether it is shown.
 */
export function currentAvailability(
  availability: Profile["availability"],
  now: Date,
): Profile["availability"] {
  if (availability === undefined) return undefined;
  if (isPlaceholder(availability.until)) return availability;
  return ukDay(now) <= availability.until ? availability : undefined;
}
