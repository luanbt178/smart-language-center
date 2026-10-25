"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

type Report = {
  generatedAt: string;
  counts: { students: number; enrollments: number; classes: number };
  leads: Record<string, number>;
  revenue: {
    billed: number;
    collected: number;
    collectedThisMonth: number;
    outstanding: number;
    overdue: number;
    monthly: Array<{ month: string; total: number }>;
  };
  attendance: Record<string, number>;
  byCourse: Array<{ courseName: string; total: number }>;
};

const leadLabels: Record<string, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  QUALIFIED: "Tiềm năng phù hợp",
  CONVERTED: "Đã chuyển đổi",
  LOST: "Đã dừng",
};

const attendanceLabels: Record<string, string> = {
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  EXCUSED: "Vắng có phép",
  ABSENT: "Vắng",
};

function money(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function ReportsView() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải báo cáo.");
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải báo cáo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const attendanceTotal = report
    ? Object.values<number>(report.attendance).reduce((a: number, b: number) => a + b, 0)
    : 0;
  const attended = report
    ? (report.attendance.PRESENT ?? 0) + (report.attendance.LATE ?? 0)
    : 0;

  const maxMonth = report
    ? Math.max(1, ...report.revenue.monthly.map((m) => m.total))
    : 1;
  const maxCourse = report
    ? Math.max(1, ...report.byCourse.map((c) => c.total))
    : 1;

  const leadTotal = report
    ? Object.values<number>(report.leads).reduce((a: number, b: number) => a + b, 0)
    : 0;
  const converted = report?.leads.CONVERTED ?? 0;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Báo cáo tổng hợp</h1>
            <p className="mt-1 text-sm text-slate-600">
              Số liệu trong phạm vi chi nhánh của bạn
              {report ? ` · cập nhật ${report.generatedAt}` : ""}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-60"
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {report && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Card label="Học viên đang học" value={String(report.counts.students)} />
              <Card label="Ghi danh đang hiệu lực" value={String(report.counts.enrollments)} />
              <Card label="Lớp đang mở" value={String(report.counts.classes)} />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="Tổng phải thu" value={money(report.revenue.billed)} />
              <Card label="Đã thu" value={money(report.revenue.collected)} />
              <Card label="Còn nợ" value={money(report.revenue.outstanding)} />
              <Card label="Nợ quá hạn" value={money(report.revenue.overdue)} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-300 bg-white p-5">
                <h2 className="mb-1 text-lg font-semibold">
                  Doanh thu 6 tháng gần nhất
                </h2>
                <p className="mb-3 text-sm text-slate-600">
                  Tháng này đã thu: {money(report.revenue.collectedThisMonth)}
                </p>

                <ul className="space-y-2 text-sm">
                  {report.revenue.monthly.map((m) => (
                    <li key={m.month}>
                      <div className="flex justify-between">
                        <span>{m.month}</span>
                        <span>{money(m.total)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded bg-slate-200">
                        <div
                          className="h-2 rounded bg-blue-700"
                          style={{ width: `${(m.total / maxMonth) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-300 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold">
                  Ghi danh theo khóa học
                </h2>

                {report.byCourse.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có ghi danh.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {report.byCourse.map((c) => (
                      <li key={c.courseName}>
                        <div className="flex justify-between">
                          <span>{c.courseName}</span>
                          <span>{c.total}</span>
                        </div>
                        <div className="mt-1 h-2 rounded bg-slate-200">
                          <div
                            className="h-2 rounded bg-blue-700"
                            style={{ width: `${(c.total / maxCourse) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-300 bg-white p-5">
                <h2 className="mb-1 text-lg font-semibold">Chuyên cần</h2>
                <p className="mb-3 text-sm text-slate-600">
                  {attendanceTotal === 0
                    ? "Chưa có dữ liệu điểm danh."
                    : `Tỷ lệ tham dự ${Math.round((attended / attendanceTotal) * 100)}% (${attended}/${attendanceTotal} lượt)`}
                </p>

                <ul className="space-y-1 text-sm">
                  {Object.entries(attendanceLabels).map(([key, label]) => (
                    <li key={key} className="flex justify-between">
                      <span>{label}</span>
                      <span>{report.attendance[key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-300 bg-white p-5">
                <h2 className="mb-1 text-lg font-semibold">
                  Khách hàng tiềm năng
                </h2>
                <p className="mb-3 text-sm text-slate-600">
                  {leadTotal === 0
                    ? "Chưa có khách hàng."
                    : `Tỷ lệ chuyển đổi ${Math.round((converted / leadTotal) * 100)}% (${converted}/${leadTotal})`}
                </p>

                <ul className="space-y-1 text-sm">
                  {Object.entries(leadLabels).map(([key, label]) => (
                    <li key={key} className="flex justify-between">
                      <span>{label}</span>
                      <span>{report.leads[key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
