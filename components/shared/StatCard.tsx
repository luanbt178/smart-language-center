import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export type Tone = "blue" | "green" | "amber" | "red" | "slate"

const toneClass: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
}

type StatCardProps = {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: Tone
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {Icon && (
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}
        >
          <Icon className="size-5" />
        </div>
      )}

      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-bold text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}