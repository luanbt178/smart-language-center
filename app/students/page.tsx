import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import StudentsManager from "./StudentsManager";

export default async function StudentsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("STUDENT_VIEW")) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <h1 className="text-xl font-bold">
            403 - Bạn không có quyền xem học viên
          </h1>

          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Quay lại Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <StudentsManager
      canCreate={session.permissions.includes("STUDENT_CREATE")}
      canUpdate={session.permissions.includes("STUDENT_UPDATE")}
    />
  );
}