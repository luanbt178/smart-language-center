import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, GraduationCap, ShieldCheck } from "lucide-react"

import { getCurrentSession } from "@/lib/auth"
import { getVisibleNav } from "@/lib/navigation"

export default async function DashboardPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  // Bỏ chính mục "Tổng quan" khỏi danh sách lối tắt.
  const items = getVisibleNav(session)
    .flatMap((group) => group.items)
    .filter((item) => item.key !== "dashboard")

  return (
    <div className="space-y-8 pb-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-32 size-48 rounded-full bg-indigo-400/20" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-blue-100">
              {session.roleName || session.role}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Xin chào, {session.fullName}!
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Chọn chức năng bên dưới hoặc dùng menu bên trái để tiếp tục công
              việc.
            </p>
          </div>

          <div className="hidden size-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 sm:flex">
            <GraduationCap className="size-10" />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Chức năng của bạn
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Các khu vực bạn được phép truy cập theo quyền tài khoản.
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            {items.length} chức năng khả dụng
          </span>
        </div>

        {items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <Icon className="size-6" />
                    </div>

                    <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </div>

                  <div className="mt-5">
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ShieldCheck className="size-7" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Chưa có chức năng khả dụng
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Tài khoản hiện chưa có quyền truy cập chức năng nào. Vui lòng
              liên hệ quản trị viên để kiểm tra vai trò và quyền hạn.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}