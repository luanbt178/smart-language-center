"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Presentation,
  CalendarCheck,
  CreditCard,
  BookOpen,
  BarChart3,
  Loader2,
  Languages,
  Settings,
  ChevronRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

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

// Các vai trò được sử dụng trong hệ thống
type Role =
  | "ADMIN"
  | "MANAGER"
  | "SALES"
  | "ACADEMIC"
  | "TEACHER"
  | "ACCOUNTANT"
  | "STUDENT"
  | "PARENT"

// Kiểu dữ liệu của từng mục menu
type MenuItem = {
  title: string
  url: string
  icon: LucideIcon
  roles: Role[]
}

// Kiểu dữ liệu của từng nhóm menu
type MenuGroup = {
  title: string
  items: MenuItem[]
}

// Danh sách menu và quyền truy cập
const menuGroups: MenuGroup[] = [
  {
    title: "TỔNG QUAN",
    items: [
      {
        title: "Tổng quan",
        url: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "QUẢN LÝ ĐÀO TẠO",
    items: [
      {
        title: "Tuyển sinh",
        url: "/sales/leads",
        icon: Users,
        roles: ["ADMIN", "MANAGER", "SALES"],
      },
      {
        title: "Học viên",
        url: "/students",
        icon: GraduationCap,
        roles: ["ADMIN", "MANAGER", "ACADEMIC", "SALES"],
      },
      {
        title: "Lớp học",
        url: "/classes",
        icon: Presentation,
        roles: ["ADMIN", "MANAGER", "ACADEMIC", "TEACHER"],
      },
      {
        title: "Điểm danh",
        url: "/attendance",
        icon: CalendarCheck,
        roles: ["ADMIN", "MANAGER", "ACADEMIC", "TEACHER"],
      },
    ],
  },
  {
    title: "TÀI CHÍNH & BÁO CÁO",
    items: [
      {
        title: "Thanh toán",
        url: "/payments",
        icon: CreditCard,
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        title: "Báo cáo",
        url: "/reports",
        icon: BarChart3,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "CỔNG HỌC TẬP",
    items: [
      {
        title: "Cổng Portal",
        url: "/portal",
        icon: BookOpen,
        roles: ["STUDENT", "PARENT"],
      },
    ],
  },
]

function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null

  const normalized = value.toUpperCase().trim()

  const validRoles: Role[] = [
    "ADMIN",
    "MANAGER",
    "SALES",
    "ACADEMIC",
    "TEACHER",
    "ACCOUNTANT",
    "STUDENT",
    "PARENT",
  ]

  return validRoles.includes(normalized as Role)
    ? (normalized as Role)
    : null
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadUserRole() {
      try {
        // Ưu tiên lấy vai trò từ API xác thực
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        if (response.ok) {
          const data = await response.json()

          const apiRole = normalizeRole(
            data?.role ?? data?.user?.role
          )

          if (!cancelled && apiRole) {
            setRole(apiRole)
            return
          }
        }

        // Dự phòng nếu dự án đang lưu thông tin người dùng
        // trong localStorage
        const storedUser =
          localStorage.getItem("user") ??
          localStorage.getItem("currentUser")

        if (storedUser) {
          const parsed = JSON.parse(storedUser)

          const storedRole = normalizeRole(
            parsed?.role ?? parsed?.user?.role
          )

          if (!cancelled && storedRole) {
            setRole(storedRole)
          }
        }
      } catch (error) {
        console.error("Không thể tải thông tin vai trò:", error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadUserRole()

    return () => {
      cancelled = true
    }
  }, [])

  // Chỉ hiển thị các mục phù hợp với vai trò hiện tại
  const authorizedGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => role !== null && item.roles.includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar className="border-r border-slate-200 bg-white">
      {/* Logo và tên hệ thống */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Languages className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900">
            Smart Language
          </p>
          <p className="truncate text-xs font-medium text-slate-500">
            Center Management
          </p>
        </div>
      </div>

      <SidebarContent className="gap-1 px-3 py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Đang tải menu...</span>
          </div>
        ) : authorizedGroups.length > 0 ? (
          authorizedGroups.map((group) => (
            <SidebarGroup key={group.title} className="py-2">
              <SidebarGroupLabel className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400">
                {group.title}
              </SidebarGroupLabel>

              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.url ||
                      pathname.startsWith(`${item.url}/`)

                    const Icon = item.icon

                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.title}
                          onClick={() => router.push(item.url)}
                          className={`h-10 w-full cursor-pointer rounded-lg px-3 transition-colors ${
                            isActive
                              ? "bg-blue-50 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 truncate">
                            {item.title}
                          </span>

                          {isActive && (
                            <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <div className="mx-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <Settings className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">
              Chưa có menu khả dụng
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Không xác định được vai trò hoặc tài khoản chưa được cấp quyền phù hợp.
            </p>
          </div>
        )}
      </SidebarContent>

      {/* Chân sidebar */}
      <div className="mt-auto border-t border-slate-100 p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
              <GraduationCap className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-700">
                Smart Language Center
              </p>
              <p className="text-[11px] text-slate-500">
                Hệ thống quản lý
              </p>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  )
}