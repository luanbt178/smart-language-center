import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import LeadsManager from "./LeadsManager";

export default async function SalesLeadsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("LEAD_VIEW")) {
    return (
      <div className="text-slate-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-8">
          <h1 className="text-xl font-bold">
            403 - Bạn không có quyền xem Lead
          </h1>

          <p className="mt-3 text-slate-600">
            Tài khoản hiện tại không được phép sử dụng chức năng này.
          </p>

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

  return <LeadsManager />;
}