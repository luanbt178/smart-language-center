import type { ReactNode } from "react"

export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Bọc bảng để cuộn ngang trên màn hình hẹp thay vì làm vỡ bố cục. */
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  )
}