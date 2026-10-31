"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Languages, Loader2, Settings } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { getVisibleNav, isActivePath } from "@/lib/navigation"
import { useCurrentUser } from "./CurrentUserProvider"

export function AppSidebar() {
  const pathname = usePathname()
  const { user, loading } = useCurrentUser()
  const { setOpenMobile } = useSidebar()

  const groups = user ? getVisibleNav(user) : []

  return (
    <Sidebar className="border-r border-slate-200">
      {/* Nhận diện hệ thống */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Languages className="size-6" />
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
            <Loader2 className="size-5 animate-spin" />
            <span>Đang tải menu...</span>
          </div>
        ) : groups.length > 0 ? (
          groups.map((group) => (
            <SidebarGroup key={group.title} className="py-2">
              <SidebarGroupLabel className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-400">
                {group.title}
              </SidebarGroupLabel>

              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href)
                    const Icon = item.icon

                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.title}
                          render={<Link href={item.href} />}
                          onClick={() => setOpenMobile(false)}
                          className={`h-10 w-full rounded-lg px-3 transition-colors ${
                            active
                              ? "bg-blue-50 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <Icon className="size-5 shrink-0" />
                          <span className="flex-1 truncate">{item.title}</span>
                          {active && (
                            <ChevronRight className="ml-auto size-4 shrink-0" />
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
            <Settings className="mx-auto mb-2 size-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">
              Chưa có menu khả dụng
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Không tải được thông tin tài khoản hoặc tài khoản chưa được cấp
              quyền. Hãy đăng nhập lại hoặc liên hệ quản trị viên.
            </p>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  )
}