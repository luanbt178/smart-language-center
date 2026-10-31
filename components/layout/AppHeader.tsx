"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getPageTitle } from "@/lib/navigation"
import { useCurrentUser } from "./CurrentUserProvider"

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useCurrentUser()
  const [loggingOut, setLoggingOut] = useState(false)

  const pageTitle = getPageTitle(pathname ?? "")

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) throw new Error("Không thể đăng xuất")

      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      setLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger
          className="size-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Mở hoặc thu gọn thanh điều hướng"
        />

        <nav aria-label="Vị trí hiện tại" className="min-w-0 text-sm">
          <span className="hidden text-slate-400 sm:inline">
            Smart Language Center /{" "}
          </span>
          <span className="truncate font-semibold text-slate-900">
            {pageTitle}
          </span>
        </nav>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label="Mở menu tài khoản"
              className="h-10 gap-2 rounded-xl px-2 hover:bg-slate-100 sm:px-3"
            />
          }
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <UserRound className="size-4" />
          </span>

          <span className="hidden text-left sm:block">
            <span className="block max-w-40 truncate text-xs font-semibold text-slate-800">
              {user?.fullName ?? "Đang tải..."}
            </span>
            <span className="block text-[11px] text-slate-500">
              {user?.roleName ?? ""}
            </span>
          </span>

          <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {user ? `${user.fullName} (${user.username})` : "Tài khoản"}
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem render={<Link href="/account" />}>
            <KeyRound />
            Đổi mật khẩu
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            <LogOut />
            {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}