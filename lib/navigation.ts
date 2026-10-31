import {
  Award,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  key: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  /** Người dùng cần có ít nhất một quyền trong danh sách (rỗng = ai đăng nhập cũng thấy). */
  permissions: string[]
  roles?: string[]
  excludeRoles?: string[]
  titleByRole?: Record<string, string>
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: "TỔNG QUAN",
    items: [
      {
        key: "dashboard",
        title: "Tổng quan",
        description: "Màn hình làm việc của bạn.",
        href: "/dashboard",
        icon: LayoutDashboard,
        permissions: [],
      },
    ],
  },
  {
    title: "QUẢN TRỊ",
    items: [
      {
        key: "users",
        title: "Tài khoản",
        description: "Tạo, khóa và quản lý tài khoản người dùng.",
        href: "/admin/users",
        icon: Users,
        permissions: ["USER_VIEW"],
      },
      {
        key: "roles",
        title: "Vai trò & quyền",
        description: "Xem và cấu hình quyền theo vai trò.",
        href: "/features/roles",
        icon: ShieldCheck,
        permissions: ["ROLE_VIEW"],
      },
      {
        key: "audit",
        title: "Nhật ký hệ thống",
        description: "Theo dõi thay đổi quan trọng trong hệ thống.",
        href: "/features/audit",
        icon: ClipboardList,
        permissions: ["AUDIT_VIEW"],
      },
    ],
  },
  {
    title: "TUYỂN SINH",
    items: [
      {
        key: "leads",
        title: "Khách hàng tiềm năng",
        description: "Quản lý lead và lịch sử tư vấn.",
        href: "/sales/leads",
        icon: UserRound,
        permissions: ["LEAD_VIEW"],
      },
      {
        key: "placement",
        title: "Kiểm tra đầu vào",
        description: "Đặt lịch và ghi nhận kết quả placement test.",
        href: "/sales/placement",
        icon: ClipboardCheck,
        permissions: ["PLACEMENT_VIEW"],
      },
    ],
  },
  {
    title: "ĐÀO TẠO",
    items: [
      {
        key: "students",
        title: "Học viên",
        description: "Hồ sơ và thông tin học viên.",
        href: "/students",
        icon: GraduationCap,
        permissions: ["STUDENT_VIEW"],
      },
      {
        key: "enrollments",
        title: "Ghi danh",
        description: "Ghi danh học viên vào khóa học và lớp.",
        href: "/enrollments",
        icon: UserPlus,
        permissions: ["ENROLLMENT_VIEW"],
      },
      {
        key: "catalog",
        title: "Danh mục khóa học",
        description: "Ngôn ngữ, chương trình, trình độ và đợt mở lớp.",
        href: "/catalog",
        icon: BookOpen,
        permissions: ["COURSE_VIEW"],
      },
      {
        key: "classes",
        title: "Lớp học & lịch",
        description: "Lớp học, phòng, giáo viên và lịch học.",
        href: "/classes",
        icon: Presentation,
        permissions: ["CLASS_VIEW"],
        excludeRoles: ["STUDENT", "PARENT"],
        titleByRole: { TEACHER: "Lớp của tôi" },
      },
      {
        key: "attendance",
        title: "Điểm danh",
        description: "Điểm danh theo từng buổi học.",
        href: "/attendance",
        icon: CalendarCheck,
        permissions: ["ATTENDANCE_VIEW", "ATTENDANCE_CREATE"],
        excludeRoles: ["STUDENT", "PARENT"],
      },
      {
        key: "assessments",
        title: "Đánh giá",
        description: "Bài kiểm tra, nhập điểm và công bố kết quả.",
        href: "/assessments",
        icon: Award,
        permissions: ["ASSESSMENT_VIEW", "ASSESSMENT_UPDATE"],
        excludeRoles: ["STUDENT", "PARENT"],
      },
      {
        key: "ai",
        title: "Trợ lý giảng dạy AI",
        description: "Hỗ trợ soạn giáo án và nhận xét (đang phát triển).",
        href: "/features/ai",
        icon: BrainCircuit,
        permissions: ["AI_USE"],
        roles: ["TEACHER"],
      },
    ],
  },
  {
    title: "TÀI CHÍNH & BÁO CÁO",
    items: [
      {
        key: "payments",
        title: "Thanh toán",
        description: "Hóa đơn, thu tiền và công nợ.",
        href: "/payments",
        icon: CreditCard,
        permissions: ["INVOICE_VIEW"],
        excludeRoles: ["STUDENT"],
        titleByRole: { PARENT: "Học phí" },
      },
      {
        key: "reports",
        title: "Báo cáo",
        description: "Số liệu tuyển sinh, học vụ và tài chính.",
        href: "/reports",
        icon: BarChart3,
        permissions: ["REPORT_VIEW"],
      },
    ],
  },
  {
    title: "CỔNG HỌC TẬP",
    items: [
      {
        key: "portal",
        title: "Cổng học tập",
        description: "Lịch học, chuyên cần, kết quả và học phí.",
        href: "/portal",
        icon: BookOpen,
        permissions: ["PORTAL_VIEW"],
      },
    ],
  },
]

export type NavUser = {
  role: string
  permissions: string[]
}

function canSee(item: NavItem, user: NavUser): boolean {
  if (item.excludeRoles?.includes(user.role)) return false
  if (item.roles && !item.roles.includes(user.role)) return false
  if (item.permissions.length === 0) return true

  return item.permissions.some((code) => user.permissions.includes(code))
}

/** Danh sách menu mà người dùng được thấy (đã áp tên riêng theo vai trò). */
export function getVisibleNav(user: NavUser): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canSee(item, user))
        .map((item) => ({
          ...item,
          title: item.titleByRole?.[user.role] ?? item.title,
        })),
    }))
    .filter((group) => group.items.length > 0)
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const extraTitles: Array<[string, string]> = [["/account", "Tài khoản của tôi"]]

/** Tên trang hiển thị trên header, lấy theo đường dẫn khớp dài nhất. */
export function getPageTitle(pathname: string): string {
  const entries: Array<[string, string]> = [
    ...navGroups.flatMap((group) =>
      group.items.map((item): [string, string] => [item.href, item.title]),
    ),
    ...extraTitles,
  ]

  const match = entries
    .filter(([href]) => isActivePath(pathname, href))
    .sort((a, b) => b[0].length - a[0].length)[0]

  return match ? match[1] : "Smart Language Center"
}