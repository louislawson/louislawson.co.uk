import { isPlaceholder, type Profile } from "./schema";

const ukDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The availability statement while it is still true, otherwise nothing. It is shown until the end
 * of the `until` day in UK time, so it is compared by calendar date there rather than as an
 * instant, which would read a plain date as UTC midnight. A placeholder date never expires; the
 * placeholder rules decide whether it is shown.
 */
export function currentAvailability(
  availability: Profile["availability"],
  now: Date,
): Profile["availability"] | undefined {
  if (isPlaceholder(availability.until)) return availability;
  // en-CA formats as YYYY-MM-DD, which sorts as a string in date order.
  return ukDate.format(now) <= availability.until ? availability : undefined;
}
