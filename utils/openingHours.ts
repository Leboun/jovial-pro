export type OpeningPeriod = {
  open: string;
  close: string;
};

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type OpeningHours = Partial<Record<DayKey, OpeningPeriod[]>>;

export type OpeningStatus = {
  status: "open" | "closed" | "unknown";
  isOpen: boolean;
  label: string;
  nextChangeLabel?: string;
  minutesToNextChange?: number;
};

type Interval = {
  start: number;
  end: number;
};

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MINUTES_IN_DAY = 24 * 60;
const MINUTES_IN_WEEK = 7 * MINUTES_IN_DAY;

const parseTimeToMinutes = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::|h)?(\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatTimeLabel = (minutes: number) => {
  const safe = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
};

const buildIntervals = (openingHours: OpeningHours) => {
  const intervals: Interval[] = [];

  DAY_KEYS.forEach((dayKey, dayIndex) => {
    const periods = openingHours[dayKey] ?? [];
    if (!Array.isArray(periods)) return;

    periods.forEach((period) => {
      const openMinutes = parseTimeToMinutes(period?.open);
      const closeMinutes = parseTimeToMinutes(period?.close);
      if (openMinutes == null || closeMinutes == null) return;

      const start = dayIndex * MINUTES_IN_DAY + openMinutes;
      let end = dayIndex * MINUTES_IN_DAY + closeMinutes;
      if (closeMinutes <= openMinutes) {
        end += MINUTES_IN_DAY;
      }

      intervals.push({ start, end });
    });
  });

  return intervals.sort((a, b) => a.start - b.start);
};

const buildDayOffsetLabel = (offset: number, dayIndex: number) => {
  if (offset === 0) return "";
  if (offset === 1) return "demain";
  const targetDay = (dayIndex + offset) % 7;
  return DAY_LABELS[targetDay];
};

const buildChangeLabel = (prefix: string, minutesFromWeek: number, dayIndex: number) => {
  const offset = Math.floor(minutesFromWeek / MINUTES_IN_DAY) - dayIndex;
  const dayLabel = buildDayOffsetLabel(offset, dayIndex);
  const timeLabel = formatTimeLabel(minutesFromWeek);
  if (!dayLabel) return `${prefix} à ${timeLabel}`;
  return `${prefix} ${dayLabel} à ${timeLabel}`;
};

export const getOpeningStatus = (
  openingHours?: OpeningHours | null,
  _timezone?: string | null,
  now: Date = new Date()
): OpeningStatus => {
  if (!openingHours || Object.keys(openingHours).length === 0) {
    return { status: "unknown", isOpen: false, label: "Horaires indisponibles" };
  }

  const intervals = buildIntervals(openingHours);
  if (intervals.length === 0) {
    return { status: "unknown", isOpen: false, label: "Horaires indisponibles" };
  }

  const dayIndex = now.getDay();
  const nowMinutes = dayIndex * MINUTES_IN_DAY + now.getHours() * 60 + now.getMinutes();

  const current = intervals.find((interval) => nowMinutes >= interval.start && nowMinutes < interval.end);
  if (current) {
    return {
      status: "open",
      isOpen: true,
      label: "Ouvert",
      nextChangeLabel: buildChangeLabel("Ferme", current.end, dayIndex),
    };
  }

  let next = intervals.find((interval) => interval.start >= nowMinutes);
  if (!next) {
    next = { ...intervals[0], start: intervals[0].start + MINUTES_IN_WEEK, end: intervals[0].end + MINUTES_IN_WEEK };
  }

  return {
    status: "closed",
    isOpen: false,
    label: "Fermé",
    nextChangeLabel: buildChangeLabel("Ouvre", next.start, dayIndex),
    minutesToNextChange: next.start - nowMinutes,
  };
};
