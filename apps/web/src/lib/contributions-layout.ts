import type { Day } from "./contributions";

// GitHub serves the calendar weekday-major (a <tr> per weekday), so the parsed
// day array is NOT in date order. Never infer position from array index —
// derive row/column from each day's actual date instead.

export type PositionedDay = Day & { row: number; col: number };
export type MonthLabel = { col: number; label: string };
export type Layout = { cells: PositionedDay[]; columns: number; months: MonthLabel[] };

const MS_PER_DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toUtcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

export function buildLayout(days: Day[]): Layout {
  if (days.length === 0) return { cells: [], columns: 0, months: [] };

  const times = days.map((d) => toUtcMs(d.date));
  const earliest = Math.min(...times);
  // The grid's first column starts on the Sunday on or before the first day.
  const startSunday = earliest - new Date(earliest).getUTCDay() * MS_PER_DAY;

  let columns = 0;
  const cells = days.map((day, i) => {
    const offset = Math.round((times[i]! - startSunday) / MS_PER_DAY);
    const col = Math.floor(offset / 7);
    if (col + 1 > columns) columns = col + 1;
    return { ...day, row: offset % 7, col };
  });

  const months: MonthLabel[] = [];
  let lastMonth = -1;
  for (let col = 0; col < columns; col++) {
    const month = new Date(startSunday + col * 7 * MS_PER_DAY).getUTCMonth();
    if (month !== lastMonth) {
      months.push({ col, label: MONTHS[month]! });
      lastMonth = month;
    }
  }

  return { cells, columns, months };
}
