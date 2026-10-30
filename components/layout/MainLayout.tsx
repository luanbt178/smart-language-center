"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"

type MainLayoutProps = {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()

  // Không hiển thị sidebar và header trên trang đăng nhập
  // hoặc trang chủ.
  const isAuthPage = pathname === "/login" || pathname === "/"

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-slate-50">
        {children}
      </main>
    )
  }

  return (
    <SidebarProvider className="min-h-svh w-full">
      <AppSidebar />

      <main className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <AppHeader />

        {/* Vùng cuộn nội dung chính */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}