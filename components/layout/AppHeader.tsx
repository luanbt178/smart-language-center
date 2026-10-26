"use client"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { LogOut, UserCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function AppHeader() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 bg-white shadow-sm">
      <div className="flex items-center gap-4">
        {/* Nút bấm tự động hiện/ẩn Sidebar của shadcn */}
        <SidebarTrigger /> 
        <h1 className="text-lg font-semibold text-slate-700 hidden sm:block">
          Hệ thống Quản lý
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-slate-600">
          <UserCircle className="w-6 h-6" />
        </Button>
        {/* <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <LogOut className="w-4 h-4 mr-2" />
          Đăng xuất
        </Button> */}
      </div>
    </header>
  )
}