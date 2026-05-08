export type TimeSlice = "today" | "week" | "month" | "all";

// Pin AEST (UTC+10) for "today" rollover stability — Sydney site owner.
// AEDT (UTC+11) during DST drifts the rollover by 1h; acceptable for v1.
const TZ_OFFSET_MS = 10 * 3600_000;

/**
 * Returns a unix-ms threshold: rows with played_at >= threshold qualify
 * as "in this time slice".
 */
export function sliceStart(slice: TimeSlice, now: number): number {
  switch (slice) {
    case "today": {
      const local = now + TZ_OFFSET_MS;
      const startOfDayLocal = local - (local % 86400_000);
      return startOfDayLocal - TZ_OFFSET_MS;
    }
    case "week":  return now - 7 * 86400_000;
    case "month": return now - 30 * 86400_000;
    case "all":   return 0;
    default:
      throw new Error(`Unknown time slice: ${slice}`);
  }
}
