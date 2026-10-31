import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import AssessmentsManager from "./AssessmentsManager";

export default async function AssessmentsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  // Học viên và phụ huynh xem điểm trong Cổng thông tin.
  if (session.role === "STUDENT" || session.role === "PARENT") {
    redirect("/portal");
  }

  if (!session.permissions.includes("ASSESSMENT_VIEW")) {
    return (
      <div className="text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <h1 className="text-xl font-bold">
            403 - Bạn không có quyền xem bài đánh giá
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
    <AssessmentsManager
      canCreate={session.permissions.includes("ASSESSMENT_CREATE")}
      canUpdate={session.permissions.includes("ASSESSMENT_UPDATE")}
    />
  );
}