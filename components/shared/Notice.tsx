import { CheckCircle2, CircleAlert, X } from "lucide-react"

export type NoticeState = { type: "success" | "error"; text: string } | null

export function Notice({
  notice,
  onClose,
}: {
  notice: NoticeState
  onClose?: () => void
}) {
  if (!notice) return null

  const success = notice.type === "success"
  const Icon = success ? CheckCircle2 : CircleAlert

  return (
    <div
      role={success ? "status" : "alert"}
      className={`mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{notice.text}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="rounded p-0.5 hover:bg-black/5"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}