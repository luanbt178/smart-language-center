import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";

const featureNames: Record<string, string> = {
  users: "Quản lý tài khoản",
  roles: "Quản lý vai trò",
  audit: "Nhật ký hệ thống",

  reports: "Báo cáo tổng quan",
  students: "Học viên",
  classes: "Lớp học",
  revenue: "Doanh thu",
  receivables: "Công nợ",

  leads: "Khách hàng tiềm năng",
  placement: "Placement Test",
  courses: "Khóa học",
  schedules: "Xếp lịch học",

  attendance: "Điểm danh",
  assessments: "Bài kiểm tra và đánh giá",

  "my-classes": "Lớp học của tôi",
  "my-schedule": "Lịch học của tôi",
  ai: "AI Teacher Copilot",

  invoices: "Hóa đơn",
  payments: "Thanh toán",

  "my-attendance": "Chuyên cần của tôi",
  "my-results": "Kết quả học tập",

  children: "Danh sách con",
  "children-schedule": "Lịch học của con",
  "children-attendance": "Chuyên cần của con",
  "children-results": "Kết quả học tập của con",
  "children-fees": "Học phí của con",
};

/**
 * Đây là quyền cần có để mở trang placeholder.
 * API thực tế vẫn phải kiểm tra quyền riêng trước khi đọc hoặc sửa dữ liệu.
 */
const featurePermissions: Record<string, string[]> = {
  users: ["USER_VIEW"],
  roles: ["ROLE_VIEW"],
  audit: ["AUDIT_VIEW"],

  reports: ["REPORT_VIEW"],

  // Tạm dùng LEAD_VIEW cho màn hình minh họa.
  // Khi triển khai module học viên thật, hãy bổ sung STUDENT_VIEW.
  students: ["LEAD_VIEW"],

  classes: ["CLASS_VIEW"],
  revenue: ["INVOICE_VIEW"],
  receivables: ["RECEIVABLE_VIEW"],

  leads: ["LEAD_VIEW"],
  placement: ["PLACEMENT_VIEW"],
  courses: ["COURSE_VIEW"],
  schedules: ["SCHEDULE_VIEW"],

  attendance: ["ATTENDANCE_VIEW", "ATTENDANCE_CREATE"],
  assessments: ["ASSESSMENT_VIEW", "ASSESSMENT_UPDATE"],

  "my-classes": ["CLASS_VIEW"],
  "my-schedule": ["SCHEDULE_VIEW"],
  ai: ["AI_USE"],

  invoices: ["INVOICE_VIEW"],
  payments: ["PAYMENT_CREATE"],

  "my-attendance": ["ATTENDANCE_VIEW"],
  "my-results": ["ASSESSMENT_VIEW"],

  children: ["PORTAL_VIEW"],
  "children-schedule": ["SCHEDULE_VIEW"],
  "children-attendance": ["ATTENDANCE_VIEW"],
  "children-results": ["ASSESSMENT_VIEW"],
  "children-fees": ["INVOICE_VIEW"],
};

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { slug } = await params;

  const featureName = featureNames[slug];
  const requiredPermissions = featurePermissions[slug];

  // URL không có trong danh sách chức năng.
  if (!featureName || !requiredPermissions) {
    notFound();
  }

  // Cho phép mở màn hình nếu có ít nhất một quyền yêu cầu.
  const allowed = requiredPermissions.some((permission) =>
    session.permissions.includes(permission),
  );

  if (!allowed) {
    return (
      <div className="text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <p className="text-sm font-semibold text-red-700">
            LỖI 403
          </p>

          <h1 className="mt-2 text-xl font-bold">
            Bạn không có quyền truy cập
          </h1>

          <p className="mt-3 text-slate-600">
            Vai trò hiện tại không được phép truy cập chức năng này.
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Tài khoản: {session.username}
          </p>

          <p className="text-sm text-slate-600">
            Vai trò: {session.role}
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Quay lại Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-lg border border-slate-300 bg-white p-6">
          <p className="text-sm text-slate-600">
            Smart Language Center
          </p>

          <h1 className="mt-2 text-2xl font-bold">
            {featureName}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Tài khoản: {session.username}
          </p>

          <p className="text-sm text-slate-600">
            Vai trò: {session.role} — {session.roleName}
          </p>
        </header>

        <section className="rounded-lg border border-slate-300 bg-white p-6">
          <h2 className="text-lg font-semibold">
            Màn hình chức năng
          </h2>

          <p className="mt-3 leading-6 text-slate-700">
            Bạn đã được phép mở màn hình này. Đây hiện là
            giao diện khung; chức năng đọc, tạo, cập nhật
            hoặc xóa dữ liệu sẽ được triển khai theo từng module.
          </p>

          <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="font-medium text-blue-950">
              Permission của màn hình
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {requiredPermissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded border border-blue-300 bg-white px-2 py-1 text-sm font-medium text-blue-900"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-md border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
          >
            Quay lại Dashboard
          </Link>
        </section>
      </div>
    </div>
  );
}