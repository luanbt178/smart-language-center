// Kiểm tra chuỗi ngày giờ dạng "2026-10-26T09:00" (từ ô datetime-local).
export function validDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;

  const date = new Date(`${value}:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 16) === value
  );
}

// Đọc điểm từ form.
//   null      = để trống
//   undefined = sai định dạng
//   number    = hợp lệ (0 - 100)
export function parseScore(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;

  const text = String(value).trim().replace(",", ".");

  if (text === "") return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return undefined;

  const score = Number(text);

  return score <= 100 ? score : undefined;
}