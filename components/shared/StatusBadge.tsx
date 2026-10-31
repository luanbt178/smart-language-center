import type { Tone } from "./StatCard"

const badgeTone: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
}

// Mã trạng thái trong hệ thống -> nhãn tiếng Việt và màu.
const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Đang hoạt động", tone: "green" },
  INACTIVE: { label: "Ngừng hoạt động", tone: "slate" },
  DRAFT: { label: "Nháp", tone: "slate" },
  ARCHIVED: { label: "Lưu trữ", tone: "slate" },
  CLOSED: { label: "Đã đóng", tone: "slate" },
  CANCELLED: { label: "Đã hủy", tone: "red" },
  VOID: { label: "Đã hủy bỏ", tone: "red" },
  ISSUED: { label: "Đã phát hành", tone: "blue" },
  PARTIAL: { label: "Thanh toán một phần", tone: "amber" },
  PAID: { label: "Đã thanh toán", tone: "green" },
  OPEN: { label: "Đang mở", tone: "amber" },
  COMPLETED: { label: "Hoàn tất", tone: "green" },
  SCHEDULED: { label: "Đã lên lịch", tone: "blue" },
  DONE: { label: "Đã diễn ra", tone: "green" },
  PUBLISHED: { label: "Đã công bố", tone: "green" },
  PRESENT: { label: "Có mặt", tone: "green" },
  ABSENT: { label: "Vắng", tone: "red" },
  LATE: { label: "Đi muộn", tone: "amber" },
  EXCUSED: { label: "Có phép", tone: "blue" },
  NEW: { label: "Mới", tone: "blue" },
  CONTACTED: { label: "Đã liên hệ", tone: "amber" },
  CONVERTED: { label: "Đã chuyển đổi", tone: "green" },
  LOST: { label: "Đã mất", tone: "slate" },
}

type StatusBadgeProps = {
  status: string
  /** Ghi đè nhãn khi cùng một mã có nghĩa khác nhau theo ngữ cảnh. */
  label?: string
  tone?: Tone
}

export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const known = STATUS[status]
  const finalTone = tone ?? known?.tone ?? "slate"
  const text = label ?? known?.label ?? status

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTone[finalTone]}`}
    >
      {text}
    </span>
  )
}