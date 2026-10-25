export const CLASS_STATUSES = ["ACTIVE", "CLOSED"] as const;

export const DAY_LABELS: Record<number, string> = {
  1: "Thứ hai",
  2: "Thứ ba",
  3: "Thứ tư",
  4: "Thứ năm",
  5: "Thứ sáu",
  6: "Thứ bảy",
  7: "Chủ nhật",
};

export const MAX_SESSIONS = 300;

export function makeClassCode(id: bigint): string {
  return `LH${id.toString().padStart(6, "0")}`;
}

export function makeTeacherCode(id: bigint): string {
  return `GV${id.toString().padStart(6, "0")}`;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type Slot = {
  dayOfWeek: number; // 1 = Thứ hai ... 7 = Chủ nhật
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export function parseSlots(
  value: unknown,
): { ok: true; data: Slot[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Cần ít nhất 1 buổi học trong tuần." };
  }

  if (value.length > 14) {
    return { ok: false, error: "Tối đa 14 buổi học mỗi tuần." };
  }

  const slots: Slot[] = [];

  for (const item of value) {
    const raw = item as Record<string, unknown>;
    const day = Number(raw.dayOfWeek);
    const start = typeof raw.startTime === "string" ? raw.startTime : "";
    const end = typeof raw.endTime === "string" ? raw.endTime : "";

    if (!Number.isInteger(day) || day < 1 || day > 7) {
      return { ok: false, error: "Thứ trong tuần không hợp lệ." };
    }

    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
      return { ok: false, error: "Giờ học phải có dạng giờ:phút (ví dụ 18:30)." };
    }

    if (start >= end) {
      return { ok: false, error: "Giờ kết thúc phải sau giờ bắt đầu." };
    }

    slots.push({ dayOfWeek: day, startTime: start, endTime: end });
  }

  // Hai khung giờ cùng thứ không được chồng nhau.
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];

      if (
        a.dayOfWeek === b.dayOfWeek &&
        a.startTime < b.endTime &&
        b.startTime < a.endTime
      ) {
        return {
          ok: false,
          error: `Hai khung giờ ${DAY_LABELS[a.dayOfWeek]} bị chồng nhau.`,
        };
      }
    }
  }

  return { ok: true, data: slots };
}

export type GeneratedSession = {
  date: string; // YYYY-MM-DD
  startAt: string; // YYYY-MM-DD HH:MM:00
  endAt: string;
};

// Sinh các buổi học từ ngày bắt đầu đến ngày kết thúc theo lịch tuần.
export function buildSessions(
  startDate: string,
  endDate: string,
  slots: Slot[],
): GeneratedSession[] {
  const result: GeneratedSession[] = [];

  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor.getTime() <= last.getTime()) {
    const jsDay = cursor.getUTCDay(); // 0 = Chủ nhật
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const date = cursor.toISOString().slice(0, 10);

    for (const slot of slots) {
      if (slot.dayOfWeek === isoDay) {
        result.push({
          date,
          startAt: `${date} ${slot.startTime}:00`,
          endAt: `${date} ${slot.endTime}:00`,
        });
      }
    }

    if (result.length > MAX_SESSIONS) {
      return result;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}
