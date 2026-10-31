import type { ReactNode } from "react"
import { AlertCircle, Inbox, Loader2 } from "lucide-react"

export function LoadingState({ text = "Đang tải dữ liệu..." }: { text?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-500"
    >
      <Loader2 className="size-5 animate-spin" />
      <span>{text}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Inbox className="size-6" />
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <AlertCircle className="mx-auto size-6 text-red-600" />
      <p className="mt-2 text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Thử lại
        </button>
      )}
    </div>
  )
}