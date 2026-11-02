import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import LessonPlanner from "./LessonPlanner";

export default async function AiPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("AI_USE")) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          403 - Bạn không có quyền dùng trợ lý AI
        </h1>

        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Quay lại Tổng quan
        </Link>
      </div>
    );
  }

  return <LessonPlanner />;
}