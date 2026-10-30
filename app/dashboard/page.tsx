
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  Users,
  ShieldCheck,
  ClipboardList,
  BarChart3,
  GraduationCap,
  UserRound,
  UserPlus,
  BookOpen,
  Presentation,
  CalendarDays,
  CalendarCheck,
  ClipboardCheck,
  Wallet,
  CreditCard,
  Receipt,
  TrendingUp,
  FileText,
  BrainCircuit,
  Clock,
  Award,
  Baby,
  type LucideIcon,
} from "lucide-react"

import { getCurrentSession } from "@/lib/auth"

const menus = {
  ADMIN: [
    ["Quản lý tài khoản", "USER_VIEW", "users"],
    ["Quản lý Role", "ROLE_VIEW", "roles"],
    ["Audit Log", "AUDIT_VIEW", "audit"],
  ],
  MANAGER: [
    ["Báo cáo", "REPORT_VIEW", "reports"],
    ["Học viên", "STUDENT_VIEW", "students"],
    ["Ghi danh", "ENROLLMENT_VIEW", "enrollments"],
    ["Lớp học", "CLASS_VIEW", "classes"],
    ["Doanh thu", "INVOICE_VIEW", "revenue"],
    ["Công nợ", "RECEIVABLE_VIEW", "receivables"],
  ],
  SALES: [
    ["Lead", "LEAD_VIEW", "leads"],
    ["Placement Test", "PLACEMENT_VIEW", "placement"],
    ["Học viên", "STUDENT_VIEW", "students"],
    ["Ghi danh", "ENROLLMENT_VIEW", "enrollments"],
    ["Khóa học", "COURSE_VIEW", "courses"],
  ],
  ACADEMIC: [
    ["Khóa học", "COURSE_VIEW", "courses"],
    ["Học viên", "STUDENT_VIEW", "students"],
    ["Ghi danh", "ENROLLMENT_VIEW", "enrollments"],
    ["Lớp học", "CLASS_VIEW", "classes"],
    ["Xếp lịch", "SCHEDULE_VIEW", "schedules"],
    ["Điểm danh", "ATTENDANCE_VIEW", "attendance"],
    ["Assessment", "ASSESSMENT_VIEW", "assessments"],
  ],
  TEACHER: [
    ["Lớp của tôi", "CLASS_VIEW", "my-classes"],
    ["Lịch dạy", "SCHEDULE_VIEW", "my-schedule"],
    ["Điểm danh", "ATTENDANCE_CREATE", "attendance"],
    ["Đánh giá", "ASSESSMENT_UPDATE", "assessments"],
    ["AI Teacher Copilot", "AI_USE", "ai"],
  ],
  ACCOUNTANT: [
    ["Hóa đơn", "INVOICE_VIEW", "invoices"],
    ["Thanh toán", "PAYMENT_CREATE", "payments"],
    ["Công nợ", "RECEIVABLE_VIEW", "receivables"],
  ],
  STUDENT: [
    ["Lịch học", "SCHEDULE_VIEW", "my-schedule"],
    ["Chuyên cần", "ATTENDANCE_VIEW", "my-attendance"],
    ["Kết quả", "ASSESSMENT_VIEW", "my-results"],
  ],
  PARENT: [
    ["Danh sách con", "PORTAL_VIEW", "children"],
    ["Lịch học", "SCHEDULE_VIEW", "children-schedule"],
    ["Chuyên cần", "ATTENDANCE_VIEW", "children-attendance"],
    ["Kết quả", "ASSESSMENT_VIEW", "children-results"],
    ["Học phí", "INVOICE_VIEW", "children-fees"],
  ],
} as const

const menuIcons: Record<string, LucideIcon> = {
  users: Users,
  roles: ShieldCheck,
  audit: ClipboardList,
  reports: BarChart3,
  students: GraduationCap,
  enrollments: UserPlus,
  classes: Presentation,
  revenue: TrendingUp,
  receivables: Receipt,
  leads: UserRound,
  placement: ClipboardCheck,
  courses: BookOpen,
  schedules: CalendarDays,
  attendance: CalendarCheck,
  assessments: Award,
  "my-classes": Presentation,
  "my-schedule": Clock,
  ai: BrainCircuit,
  invoices: FileText,
  payments: CreditCard,
  "my-attendance": CalendarCheck,
  "my-results": Award,
  children: Baby,
  "children-schedule": CalendarDays,
  "children-attendance": CalendarCheck,
  "children-results": Award,
  "children-fees": Wallet,
}

function getMenuHref(slug: string, role: string): string {
  if (slug === "users") return "/admin/users"
  if (slug === "leads") return "/sales/leads"
  if (slug === "placement") return "/sales/placement"
  if (slug === "students") return "/students"
  if (slug === "enrollments") return "/enrollments"

  if (
    slug === "classes" ||
    slug === "schedules" ||
    slug === "my-classes"
  ) {
    return "/classes"
  }

  if (slug === "attendance") return "/attendance"
  if (slug === "reports") return "/reports"
  if (slug === "assessments") return "/assessments"

  if (
    slug === "children" ||
    slug === "children-schedule" ||
    slug === "children-results" ||
    slug === "my-results" ||
    slug === "children-attendance" ||
    slug === "my-attendance" ||
    (slug === "my-schedule" && role !== "TEACHER")
  ) {
    return "/portal"
  }

  if (slug === "my-schedule") return "/classes"

  if (
    slug === "invoices" ||
    slug === "payments" ||
    slug === "receivables" ||
    slug === "revenue" ||
    slug === "children-fees"
  ) {
    return "/payments"
  }

  if (slug === "courses") return "/catalog"

  return `/features/${slug}`
}

export default async function DashboardPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  const roleMenus =
    menus[session.role as keyof typeof menus] ?? []

  const visibleMenus = roleMenus.filter(([label, permission, slug]) =>
    session.permissions.includes(permission)
  )

  return (
    <div className="space-y-8 pb-8">
      {/* Tiêu đề trang */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">
            SMART LANGUAGE CENTER
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tổng quan hệ thống
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Chào mừng bạn quay lại. Đây là không gian làm việc của bạn.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4" />
          <span>Trung tâm quản lý đào tạo</span>
        </div>
      </section>

      {/* Thẻ chào mừng */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-indigo-400/20" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-50">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Phiên đăng nhập đang hoạt động
            </div>

            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Xin chào, {session.fullName}!
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Hãy chọn chức năng bên dưới để tiếp tục công việc của bạn
              trong hệ thống Smart Language Center.
            </p>
          </div>

          <div className="flex h-20 w-20 shrink-0 items-center justify-center self-start rounded-2xl border border-white/20 bg-white/10 sm:self-center">
            <GraduationCap className="h-10 w-10" />
          </div>
        </div>
      </section>

      {/* Thông tin tài khoản */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Thông tin tài khoản
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Thông tin phiên làm việc hiện tại của bạn.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Họ và tên
              </p>
              <p className="mt-1 truncate font-semibold text-slate-900">
                {session.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Username
              </p>
              <p className="mt-1 truncate font-semibold text-slate-900">
                {session.username}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Vai trò
              </p>
              <p className="mt-1 truncate font-semibold text-slate-900">
                {session.roleName || session.role}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Mã vai trò: {session.role}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Các chức năng được cấp quyền */}
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
            {visibleMenus.length} chức năng khả dụng
          </span>
        </div>

        {visibleMenus.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMenus.map(([label, permission, slug]) => {
              const Icon = menuIcons[slug] ?? BookOpen
              const href = getMenuHref(slug, session.role)

              return (
                <Link
                  key={slug}
                  href={href}
                  className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>

                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all group-hover:bg-blue-50 group-hover:text-blue-600">
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-5">
                    <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-blue-700">
                      {label}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Quyền truy cập: {permission}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Chưa có chức năng khả dụng
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Tài khoản hiện chưa có quyền truy cập các chức năng trên
              Dashboard. Vui lòng liên hệ quản trị viên để kiểm tra vai trò
              và quyền hạn.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
