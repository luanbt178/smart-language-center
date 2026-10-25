import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import ClassesManager from "./ClassesManager";

export default async function ClassesPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("CLASS_VIEW")) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <h1 className="text-xl font-bold">
            403 - Bạn không có quyền xem lớp học
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
    <ClassesManager
      canCreate={session.permissions.includes("CLASS_CREATE")}
      canUpdate={session.permissions.includes("CLASS_UPDATE")}
      canSchedule={session.permissions.includes("SCHEDULE_CREATE")}
    />
  );
}
