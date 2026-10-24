import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";

const menus = {
  ADMIN: [
    ["Quản lý tài khoản", "USER_VIEW", "users"],
    ["Quản lý Role", "ROLE_VIEW", "roles"],
    ["Audit Log", "AUDIT_VIEW", "audit"],
  ],

  MANAGER: [
    ["Báo cáo", "REPORT_VIEW", "reports"],
    ["Học viên", "LEAD_VIEW", "students"],
    ["Lớp học", "CLASS_VIEW", "classes"],
    ["Doanh thu", "INVOICE_VIEW", "revenue"],
    ["Công nợ", "RECEIVABLE_VIEW", "receivables"],
  ],

  SALES: [
    ["Lead", "LEAD_VIEW", "leads"],
    ["Placement Test", "PLACEMENT_VIEW", "placement"],
    ["Khóa học", "COURSE_VIEW", "courses"],
  ],

  ACADEMIC: [
    ["Khóa học", "COURSE_VIEW", "courses"],
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
} as const;

export default async function DashboardPage() {
  const session =
    await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const roleMenus =
    menus[
      session.role as keyof typeof menus
    ] ?? [];

  const visibleMenus =
    roleMenus.filter(
      ([, permission]) =>
        session.permissions.includes(
          permission,
        ),
    );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white text-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-bold">
              Smart Language Center
            </h1>

            <p className="text-sm text-gray-500">
              Dashboard
            </p>
          </div>

          <form
            action="/api/auth/logout"
            method="POST"
          >
            <button
              type="submit"
              className="rounded-md border border-slate-800 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl p-6">
        <div className="mb-6 rounded-lg border border-slate-300 bg-white p-6 text-slate-900">
          <h2 className="text-xl font-bold">
            Xin chào,{" "}
            {session.fullName}
          </h2>

          <p className="mt-2 text-sm">
            Username:{" "}
            <strong>
              {session.username}
            </strong>
          </p>

          <p className="mt-1 text-sm">
            Role:{" "}
            <strong>
              {session.role}
            </strong>
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {session.roleName}
          </p>
        </div>

        <h2 className="mb-4 text-lg font-semibold">
          Chức năng
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleMenus.map(
            ([label, permission, slug]) => (
              <Link
                key={slug}
                href={
                    slug === "users"
                        ? "/admin/users"
                        : slug === "leads"
                            ? "/sales/leads"
                            : slug === "courses"
                                ? "/catalog"
                                : `/features/${slug}`
                }
                className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900 hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <h3 className="font-semibold">
                  {label}
                </h3>

                <p className="mt-2 text-xs text-slate-600">
                  Permission:{" "}
                  {permission}
                </p>
              </Link>
            ),
          )}
        </div>
      </section>
    </main>
  );
}