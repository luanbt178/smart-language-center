import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import EnrollmentsManager from "./EnrollmentsManager";

export default async function EnrollmentsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("ENROLLMENT_VIEW")) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <h1 className="text-xl font-bold">
            403 - Bạn không có quyền xem ghi danh
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
    <EnrollmentsManager
      canCreate={session.permissions.includes("ENROLLMENT_CREATE")}
      canUpdate={session.permissions.includes("ENROLLMENT_UPDATE")}
    />
  );
}
