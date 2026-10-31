import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import AttendanceManager from "./AttendanceManager";

export default async function AttendancePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("ATTENDANCE_VIEW")) {
    return (
      <div className="text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <h1 className="text-xl font-bold">
            403 - Bạn không có quyền xem điểm danh
          </h1>

          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Quay lại Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AttendanceManager
      canRecord={session.permissions.includes("ATTENDANCE_CREATE")}
    />
  );
}
