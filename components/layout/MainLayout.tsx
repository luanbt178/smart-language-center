"use client"
import { usePathname } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Không hiển thị Sidebar và Header ở trang đăng nhập hoặc trang chủ
  const isAuthPage = pathname === "/login" || pathname === "/"

  if (isAuthPage) {
    return <main className="min-h-screen bg-slate-50">{children}</main>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <AppHeader />
        {/* Khu vực chứa nội dung chính của từng trang */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}