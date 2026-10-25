export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
] as const;

export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  LATE: "Đi muộn",
  EXCUSED: "Vắng có phép",
};

export type AttendanceInput = {
  studentId: bigint;
  status: string;
  note: string | null;
};

export function parseAttendanceRecords(
  value: unknown,
):
  | { ok: true; data: AttendanceInput[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Không có dữ liệu điểm danh." };
  }

  if (value.length > 500) {
    return { ok: false, error: "Quá nhiều học viên trong một lần lưu." };
  }

  const seen = new Set<string>();
  const result: AttendanceInput[] = [];

  for (const item of value) {
    const raw = item as Record<string, unknown>;
    const studentText = String(raw.studentId ?? "");

    if (!/^\d+$/.test(studentText)) {
      return { ok: false, error: "Học viên không hợp lệ." };
    }

    if (seen.has(studentText)) {
      return { ok: false, error: "Có học viên bị lặp trong danh sách." };
    }

    seen.add(studentText);

    const status = typeof raw.status === "string" ? raw.status : "";

    if (!(ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, error: "Trạng thái điểm danh không hợp lệ." };
    }

    let note: string | null = null;

    if (raw.note !== undefined && raw.note !== null) {
      if (typeof raw.note !== "string" || raw.note.trim().length > 500) {
        return { ok: false, error: "Ghi chú tối đa 500 ký tự." };
      }

      note = raw.note.trim() === "" ? null : raw.note.trim();
    }

    result.push({ studentId: BigInt(studentText), status, note });
  }

  return { ok: true, data: result };
}
