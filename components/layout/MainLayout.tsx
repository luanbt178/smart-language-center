"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"
import { CurrentUserProvider } from "./CurrentUserProvider"

export function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Trang đăng nhập và trang chủ không có sidebar/header.
  const isAuthPage = pathname === "/login" || pathname === "/"

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>
  }

  return (
    <CurrentUserProvider>
      <SidebarProvider className="min-h-svh w-full">
        <AppSidebar />

        <div className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
          <AppHeader />

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </CurrentUserProvider>
  )
}