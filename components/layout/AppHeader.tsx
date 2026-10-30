
"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

const pageTitles: Record<string, string> = {
  "/dashboard": "Tổng quan",
  "/sales/leads": "Tuyển sinh",
  "/students": "Học viên",
  "/classes": "Lớp học",
  "/attendance": "Điểm danh",
  "/payments": "Thanh toán",
  "/reports": "Báo cáo",
  "/portal": "Cổng học tập",
}

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const currentPath =
    Object.keys(pageTitles)
      .sort((a, b) => b.length - a.length)
      .find(
        (path) =>
          pathname === path || pathname?.startsWith(`${path}/`),
      ) ?? ""

  const pageTitle = pageTitles[currentPath] ?? "Smart Language Center"

  const handleLogout = async () => {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Không thể đăng xuất")
      }

      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      setLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <SidebarTrigger
          className="size-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Mở hoặc thu gọn thanh điều hướng"
        >
          <Menu className="size-5" />
        </SidebarTrigger>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
            {pageTitle}
          </p>
          <p className="hidden text-xs text-slate-500 sm:block">
            Smart Language Center / {pageTitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Thông báo"
          className="relative size-9 rounded-lg text-slate-600 hover:bg-slate-100"
          onClick={() => {
            // Chưa có luồng thông báo: giữ nút ở trạng thái giao diện.
          }}
        >
          <Bell className="size-[18px]" />
        </Button>

        <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={userMenuOpen}
            aria-label="Mở menu tài khoản"
            className="h-10 gap-2 rounded-xl px-2 hover:bg-slate-100 sm:px-3"
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <UserRound className="size-4" />
            </span>

            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold text-slate-800">
                Tài khoản
              </span>
              <span className="block text-[11px] text-slate-500">
                Người dùng hệ thống
              </span>
            </span>

            <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
          </Button>

          {userMenuOpen && (
            <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <LogOut className="size-4" />
                {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
