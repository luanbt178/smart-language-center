"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { 
  LayoutDashboard, Users, BookOpen, CalendarCheck, 
  CreditCard, BarChart3, Presentation, GraduationCap, Loader2
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// 1. Cấu hình Menu & Phân quyền chuẩn theo yêu cầu dự án
const menuItems = [
  { title: "Tổng quan", url: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER"] },
  { title: "Tuyển sinh", url: "/sales/leads", icon: Users, roles: ["ADMIN", "MANAGER", "SALES"] },
  { title: "Học viên", url: "/students", icon: GraduationCap, roles: ["ADMIN", "MANAGER", "ACADEMIC", "SALES"] },
  { title: "Lớp học", url: "/classes", icon: Presentation, roles: ["ADMIN", "MANAGER", "ACADEMIC", "TEACHER"] },
  { title: "Điểm danh", url: "/attendance", icon: CalendarCheck, roles: ["ADMIN", "MANAGER", "ACADEMIC", "TEACHER"] },
  { title: "Thanh toán", url: "/payments", icon: CreditCard, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
  { title: "Cổng Portal", url: "/portal", icon: BookOpen, roles: ["STUDENT", "PARENT"] },
  { title: "Báo cáo", url: "/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 2. Lấy thông tin người dùng đang đăng nhập
    // Thử lấy từ localStorage trước (nếu dự án lưu thông tin tại đây)
    const storedUser = localStorage.getItem("user") || localStorage.getItem("currentUser")
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        if (parsed.role) {
          setRole(parsed.role.toUpperCase())
          setLoading(false)
          return
        }
      } catch (e) {}
    }
    
    // Nếu không có, gọi API để lấy Role từ Cookie
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.role) setRole(data.role.toUpperCase())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

 // 3. Lọc ra các Menu (Tạm thời vô hiệu hóa bộ lọc để xem Full Giao diện)
  const authorizedItems = menuItems; 
  /* Code cũ đang bị lỗi do role = null:
  const authorizedItems = menuItems.filter(item => {
    if (!role) return false 
    return item.roles.includes(role)
  })
  */

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold text-slate-800 my-2">
            Smart Language AI
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            {loading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <SidebarMenu>
                {authorizedItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Link href={item.url} className="flex w-full">
                      <SidebarMenuButton isActive={pathname?.startsWith(item.url)} className="w-full cursor-pointer">
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
          
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}