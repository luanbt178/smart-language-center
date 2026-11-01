"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CircleAlert,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Receipt,
  RefreshCw,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard, type Tone } from "@/components/shared/StatCard";
import { LoadingState } from "@/components/shared/states";

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

function Card({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return <StatCard label={label} value={value} icon={icon} tone={tone} />;
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
    <div className="text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Báo cáo tổng hợp"
          description={`Số liệu trong phạm vi chi nhánh của bạn${report ? ` · cập nhật ${report.generatedAt}` : ""}`}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              {loading ? "Đang tải..." : "Tải lại"}
            </Button>
          }
        />

        <Notice notice={error ? { type: "error", text: error } : null} />

        {loading && !report && <LoadingState text="Đang tải báo cáo..." />}

        {report && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Card icon={Users} tone="blue" label="Học viên đang học" value={String(report.counts.students)} />
              <Card icon={ClipboardList} tone="blue" label="Ghi danh đang hiệu lực" value={String(report.counts.enrollments)} />
              <Card icon={GraduationCap} tone="green" label="Lớp đang mở" value={String(report.counts.classes)} />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card icon={Receipt} tone="blue" label="Tổng phải thu" value={money(report.revenue.billed)} />
              <Card icon={CheckCircle2} tone="green" label="Đã thu" value={money(report.revenue.collected)} />
              <Card icon={Wallet} tone="amber" label="Còn nợ" value={money(report.revenue.outstanding)} />
              <Card icon={CircleAlert} tone="red" label="Nợ quá hạn" value={money(report.revenue.overdue)} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${(m.total / maxMonth) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-blue-600"
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
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
    </div>
  );
}
