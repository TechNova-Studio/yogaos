/**
 * Timezone and Date-boundary utility for deterministic session generation.
 */

export function parseLocalTimeToUtc(
  year: number,
  month: number, // 1-based (1..12)
  day: number,
  timeStr: string, // "HH:mm"
  timezone = 'Asia/Kolkata'
): Date {
  const [hoursStr, minsStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minsStr, 10);

  // Pad numbers
  const y = year.toString().padStart(4, '0');
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  const h = hours.toString().padStart(2, '0');
  const min = minutes.toString().padStart(2, '0');

  // Parse local ISO string representation
  // For Asia/Kolkata (+05:30)
  if (timezone === 'Asia/Kolkata') {
    return new Date(`${y}-${m}-${d}T${h}:${min}:00.000+05:30`);
  }

  if (timezone === 'UTC') {
    return new Date(`${y}-${m}-${d}T${h}:${min}:00.000Z`);
  }

  // Generic IANA timezone offset calculation
  const targetIso = `${y}-${m}-${d}T${h}:${min}:00`;
  const tempDate = new Date(targetIso + 'Z');

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(tempDate);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const tzYear = parseInt(partMap.year, 10);
    const tzMonth = parseInt(partMap.month, 10);
    const tzDay = parseInt(partMap.day, 10);
    const tzHour = parseInt(partMap.hour, 10);
    const tzMin = parseInt(partMap.minute, 10);

    const targetLocalMillis = Date.UTC(year, month - 1, day, hours, minutes);
    const tzFormattedMillis = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin);
    const offsetMillis = tzFormattedMillis - tempDate.getTime();

    return new Date(targetLocalMillis - offsetMillis);
  } catch (err) {
    // Fallback to Asia/Kolkata if timezone unrecognized
    return new Date(`${y}-${m}-${d}T${h}:${min}:00.000+05:30`);
  }
}

/**
 * Returns UTC midnight date for a given YYYY-MM-DD string or (year, month, day)
 */
export function getUtcSessionDate(
  dateOrYear: string | number,
  month?: number,
  day?: number
): Date {
  if (typeof dateOrYear === 'string') {
    const [yStr, mStr, dStr] = dateOrYear.slice(0, 10).split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  return new Date(Date.UTC(dateOrYear, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0));
}
